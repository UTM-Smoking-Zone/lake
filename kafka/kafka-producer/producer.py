import json
import time
import signal
import threading
from datetime import datetime, timezone
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
            'api.version.request': False,
            'broker.version.fallback': '0.10.0',
            'api.version.request.timeout.ms': 30000,
            'socket.timeout.ms': 30000,
            'message.timeout.ms': 60000,
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
        self.wsapp = None
        self.reconnect_lock = threading.Lock()
        self.message_count = 0

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
                print(f"Connection error: {e}")
            finally:
                self.is_connected = False

            if self.should_reconnect and not self.should_stop:
                self._handle_reconnection()

    def _on_open(self, wsapp) -> None:
        """Handle websocket open."""
        self.is_connected = True
        self.reconnect_attempts = 0
        self.reconnect_interval = 1
        print(f"✅ Connected to {self.websocket_url}")

        try:
            wsapp.send(json.dumps(self.subscription_params))
            print(f"📡 Subscribed to {self.subscription_params['args']}")
        except Exception as e:
            print(f"❌ Subscription error: {e}")
            wsapp.close()

    def _on_message(self, wsapp, message) -> None:
        """Handle incoming messages."""
        try:
            parsed_message = json.loads(message)
            
            if self._handle_data_message(parsed_message):
                return
            elif self._handle_system_message(parsed_message):
                return
            
        except json.JSONDecodeError:
            return
        except Exception as e:
            print(f"Message handling error: {e}")
        
    def _handle_data_message(self, parsed_message: Dict) -> bool:
        """Handle data."""
        if 'data' not in parsed_message:
            return False
        
        try:
            data_list = parsed_message['data']
            if not isinstance(data_list, list):
                return True
            
            for data in data_list:
                if self._validate_trade_data(data):
                    # ✅ ТРАНСФОРМИРОВАТЬ данные для consumer
                    transformed_data = self._transform_bybit_data(data)
                    partition_key = self._generate_partition_key(transformed_data)
                    self._send_to_kafka(partition_key, transformed_data)

            self.producer.poll(0)
            return True
        
        except Exception as e:
            print(f"Data handling error: {e}")
            return True

    def _transform_bybit_data(self, bybit_data: Dict) -> Dict:
        """Transform Bybit format to consumer format."""
        try:
            # Bybit timestamp в миллисекундах
            timestamp_ms = int(bybit_data['T'])
            dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
            
            # Формат для consumer
            transformed = {
                'symbol': 'BTCUSDT',
                'timestamp': dt.isoformat(),
                'price': float(bybit_data['p']),
                'volume': float(bybit_data['v']),
                'side': bybit_data['S'].lower(),  # 'Buy' -> 'buy'
                'trade_id': str(bybit_data.get('i', f"{timestamp_ms}")),
                'source': 'bybit',
                'processing_time': datetime.now(timezone.utc).isoformat(),
                'date_partition': dt.date().isoformat()
            }
            
            return transformed
            
        except Exception as e:
            print(f"Transform error: {e}")
            # Fallback
            return {
                'symbol': 'BTCUSDT',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'price': float(bybit_data.get('p', 0)),
                'volume': float(bybit_data.get('v', 0)),
                'side': bybit_data.get('S', 'unknown').lower(),
                'trade_id': str(bybit_data.get('i', 'unknown')),
                'source': 'bybit',
                'processing_time': datetime.now(timezone.utc).isoformat(),
                'date_partition': datetime.now(timezone.utc).date().isoformat()
            }

    def _handle_system_message(self, parsed_message: Dict) -> bool:
        """Handle system message."""
        if 'success' in parsed_message:
            print(f"✅ Subscription successful: {parsed_message}")
            return True
        elif 'error' in parsed_message:
            print(f"❌ Error: {parsed_message}")
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
        trade_id = data.get('trade_id')
        if trade_id:
            return str(trade_id)
        
        # Fallback to timestamp
        timestamp = data.get('timestamp', datetime.now().isoformat())
        return str(hash(timestamp) % 1000)
    
    def _send_to_kafka(self, key: str, data: Dict) -> None:
        """Send message to Kafka."""
        try:
            self.producer.produce(
                topic=self.topic_name,
                key=key.encode('utf-8'),
                value=self._serializer(data),
                on_delivery=self._delivery_report
            )
            
            self.message_count += 1
            if self.message_count % 100 == 0:
                print(f"📊 Sent {self.message_count} messages to Kafka")

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
                print(f"❌ Buffer full: {e}")
        except Exception as e:
            print(f"❌ Kafka send error: {e}")

    def _on_error(self, wsapp, error) -> None:
        """Handle WebSocket errors"""
        print(f"⚠️ WebSocket error: {error}")
        self.is_connected = False

    def _on_close(self, wsapp, close_status_code, close_msg) -> None:
        """Handle WebSocket close"""
        print(f"🔌 Connection closed: {close_status_code} - {close_msg}")
        self.is_connected = False

    def _handle_reconnection(self):
        """Handle reconnection with exponential backoff"""
        if not self.should_reconnect or self.should_stop:
            return
            
        with self.reconnect_lock:
            self.reconnect_attempts += 1
            print(f"🔄 Reconnecting (attempt {self.reconnect_attempts})...")
            
            time.sleep(self.reconnect_interval)
            
            jitter = (time.time() % 1) * 0.1
            self.reconnect_interval = min(
                self.reconnect_interval * 1.5 + jitter,
                self.max_reconnect_interval
            )

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        print("\n🛑 Shutting down...")
        self.stop()

    def stop(self):
        """Graceful shutdown with message flush"""
        self.should_reconnect = False
        self.should_stop = True
        self.is_connected = False
        
        if self.wsapp:
            try:
                self.wsapp.close()
            except Exception:
                pass
        
        try:
            print("📤 Flushing remaining messages...")
            remaining = self.producer.flush(timeout=30)
            if remaining > 0:
                print(f"⚠️ {remaining} messages failed to send")
            else:
                print("✅ All messages sent successfully")
        except Exception as e:
            print(f"❌ Flush error: {e}")

    def get_connection_status(self) -> Dict:
        """Get current connection status"""
        return {
            'is_connected': self.is_connected,
            'reconnect_attempts': self.reconnect_attempts,
            'should_reconnect': self.should_reconnect,
            'messages_sent': self.message_count
        }

    @staticmethod
    def _delivery_report(error, msg) -> None:
        """Kafka delivery report callback"""
        if error is not None:
            print(f"❌ Delivery failed: {error}")

    @staticmethod
    def _serializer(data: Dict) -> bytes:
        """Serialize data to bytes"""
        return json.dumps(data).encode()


def main():
    print("🚀 Starting Bybit WebSocket Producer")
    
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

    try:
        producer.connect()
    except KeyboardInterrupt:
        print("\n⚠️ Interrupted by user")
    finally:
        producer.stop()


if __name__ == "__main__":
    main()