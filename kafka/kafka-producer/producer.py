import json
import time
import signal
import threading

from typing import Dict
from websocket import WebSocketApp
from confluent_kafka import Producer

class WebsocketProducer:
    def __init__(
            self, websocket_url: str, subscription_params: str,
            kafka_config: Dict[str, str],
            topic_name: str):
        
        self.websocket_url = websocket_url
        self.subscription_params = subscription_params
        self.topic_name = topic_name
       

        config = {
            'bootstrap.servers': 'kafka:9092',
            'client.id': 'websocket-producer',
            'acks': 'all',
            'retries': 2147483647,
            'retry.backoff.ms': 1000,
            'delivery.timeout.ms': 300000,
            'batch.size': 16384,
            'linger.ms': 5,
            'compression.type': 'snappy',
            'max.in.flight.requests.per.connection': 5,
            'enable.idempotence': True,
            **kafka_config
        }

        self.producer = Producer(config)

        self.is_connected = False
        self.should_reconnect = True
        self.should_stop = False
        self.reconnect_interval = 1
        self.max_reconnect_interval = 60
        self.reconnect_attempts = 0

        # Websocket instance
        self.wsapp = None

        # Thread safety
        self.reconnect_lock = threading.Lock()

        # Setup signal handlers
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def connect(self) -> None:
        while self.should_reconnect and not self.should_stop:
            try:
                self.wsapp = WebSocketApp(
                    self.websocket_url,
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_error=self._on_error
                )
                self.wsapp.run_forever()

            except Exception as e:
                pass
            finally:
                self.is_connected = False

            if self.should_reconnect and not self.should_stop:
                self._handle_reconnection()

    def _on_open(self, wsapp) -> None:
        """Handle websocket open."""
        self.is_connected = True
        self.reconnect_attempts = 0
        self.reconnect_interval = 1

        try:
            wsapp.send(json.dumps(self.subscription_params))
        except Exception as e:
            wsapp.close()

    def _on_message(self, wsapp, message) -> None:
        """Handle incoming messages."""
        try:
            try:
                parsed_message = json.loads(message)
            except json.JSONDecodeError:
                return
            
            if self._handle_data_message(parsed_message):
                return
            elif self._handle_system_message(parsed_message):
                return
            
        except Exception as e:
            pass
        
    def _handle_data_message(self, parsed_message: Dict) -> bool:
        """Hadnle data."""
        if 'data' not in parsed_message:
            return False
        
        try:
            data_list = parsed_message['data']
            if not isinstance(data_list, list):
                return True
            
            for data in data_list:
                if self._validate_trade_data(data):
                    partition_key = self._generate_partition_key(data)
                    self._send_to_kafka(partition_key, data)

            self.producer.poll(0)

            return True
        
        except Exception as e:
            return True

    def _handle_system_message(self, parsed_message: Dict) -> bool:
        """Handle system message."""
        if 'success' in parsed_message:
            return True
        elif 'error' in parsed_message:
            return True
        elif 'topic' in parsed_message and parsed_message['topic'] == 'heartbeat':
            return True
        elif 'op' in parsed_message:
            return True
        return False

    def _validate_trade_data(self, data: Dict) -> bool:
        """Validate data."""
        required_fields = ['T', 'p', 'v', 'S']

        try:
            for field in required_fields:
                if field not in data:
                    return False
            
            float(data['p'])
            float(data['v'])
            int(data['T'])

            if data['S'] not in ['Buy', 'Sell']:
                return False

            return True
        
        except (ValueError, TypeError):
            return False

    def _generate_partition_key(self, data: Dict) -> str:
        """Generate partition key."""
        trade_id = data.get('i')

        if trade_id:
            return str(trade_id)
        
        timestamp = data.get('T', int(time.time() * 1000))

        return str(timestamp % 1000)
    
    def _send_to_kafka(self, key: str, data: Dict) -> None:
        """Send message to Kafka."""
        try:
            self.producer.produce(
                topic=self.topic_name,
                key=key.encode('utf-8'),
                value=self._serializer(data),
                on_delivery=self._delivery_report
            )

        except BufferError:
            self.producer.poll(1)

            try:
                self.producer.produce(
                    topic=self.topic_name,
                    key=key.encode('utf-8'),
                    value=self._serializer(data),
                    on_delivery=self._delivery_report
                )

            except BufferError as e:
                pass
        
        except Exception:
            pass

    # @staticmethod
    # def _on_error(ws, error) -> None:
    #     print(error)

    # @staticmethod
    # def _delivery_report(error, msg) -> None:
    #     if error is not None:
    #         print("Delivery failed for record {}: {}".format(msg.key(), error))

    # @staticmethod
    # def _serializer(x: str) -> bytes:
    #     return json.dumps(x).encode()
    
    def _on_error(self, wsapp, error) -> None:
        """Handle WebSocket errors"""
        self.is_connected = False

    def _on_close(self, wsapp, close_status_code, close_msg) -> None:
        """Handle WebSocket close"""
        self.is_connected = False

    def _handle_reconnection(self):
        """Handle reconnection with exponential backoff"""
        if not self.should_reconnect or self.should_stop:
            return
            
        with self.reconnect_lock:
            self.reconnect_attempts += 1
            
            time.sleep(self.reconnect_interval)
            
            # Exponential backoff with jitter
            jitter = (time.time() % 1) * 0.1
            self.reconnect_interval = min(
                self.reconnect_interval * 1.5 + jitter,
                self.max_reconnect_interval
            )

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        self.stop()

    def stop(self):
        """Graceful shutdown with message flush"""
        self.should_reconnect = False
        self.should_stop = True
        self.is_connected = False
        
        # Close WebSocket connection
        if self.wsapp:
            try:
                self.wsapp.close()
            except Exception:
                pass
        
        # Flush remaining messages to Kafka
        try:
            remaining = self.producer.flush(timeout=30)
        except Exception:
            pass

    def get_connection_status(self) -> Dict:
        """Get current connection status"""
        return {
            'is_connected': self.is_connected,
            'reconnect_attempts': self.reconnect_attempts,
            'should_reconnect': self.should_reconnect
        }

    @staticmethod
    def _delivery_report(error, msg) -> None:
        """Kafka delivery report callback"""
        pass

    @staticmethod
    def _serializer(data: Dict) -> bytes:
        """Serialize data to bytes"""
        return json.dumps(data).encode()

def main():
    websocket_url = 'wss://stream.bybit.com/v5/public/linear'

    subscription_params = {
        "op": "subscribe",
        "args": ['publicTrade.BTCUSDT']
    }

    kafka_config = {
        'bootstrap.servers': 'kafka:9092',   
    }

    topic_name = 'btcusdt-bybit'

    producer = WebsocketProducer(
        websocket_url,
        subscription_params,
        kafka_config,
        topic_name
    )

    # producer.connect()

    try:
        producer.connect()
    except KeyboardInterrupt:
        pass
    finally:
        producer.stop()


if __name__ == "__main__":
    main()