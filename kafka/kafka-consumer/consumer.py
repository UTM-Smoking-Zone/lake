# consumer.py (main orchestrator)
from collections import deque
from typing import List
import time
import os
import redis
from datetime import datetime
from kafka_client import KafkaClient
from data_validator import DataValidator
from data_transformer import DataTransformer
from iceberg_writer import IcebergWriter
from postgres_writer import PostgresWriter
from batch_manager import BatchManager
from config import KafkaConfig, IcebergConfig, BatchConfig

class CryptoConsumer:
    def __init__(self):
        # Initialize configurations
        self.kafka_config = KafkaConfig()
        self.iceberg_config = IcebergConfig()
        self.batch_config = BatchConfig()
        
        # Initialize components
        self.kafka_client = KafkaClient(self.kafka_config)
        self.validator = DataValidator()
        self.transformer = DataTransformer()
        self.iceberg_writer = IcebergWriter(self.iceberg_config)
        self.postgres_writer = PostgresWriter()
        self.batch_manager = BatchManager(
            self.batch_config,
            self.iceberg_writer.write_batch
        )
        
        # Initialize Redis connection for real-time prices
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'redis'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            decode_responses=True,
            socket_connect_timeout=5
        )
        
        # Test Redis connection
        try:
            self.redis_client.ping()
            print("✅ Connected to Redis successfully")
        except Exception as e:
            print(f"❌ Failed to connect to Redis: {e}")
        
        # Live data structures (keep for backward compatibility)
        self.live_graph = {}
        self.live_table = deque([], 15)
        
        # Metrics
        self.message_count = 0
        self.error_count = 0
        self.last_log_time = time.time()
        self.last_redis_update = 0
        self.last_postgres_flush = time.time()
    
    def start(self, topics: List[str]) -> None:
        self.kafka_client.subscribe(topics)
        print(f"🚀 Consumer started, processing messages...")
        
        try:
            while True:
                message = self.kafka_client.poll_message()
                if message is None:
                    # Print heartbeat every 10 seconds if no messages
                    if time.time() - self.last_log_time > 10:
                        print(f"⏳ Waiting for messages... (processed: {self.message_count}, errors: {self.error_count})")
                        self.last_log_time = time.time()
                    continue
                
                self._process_message(message)
                
                # Log progress every 100 messages
                self.message_count += 1
                if self.message_count % 100 == 0:
                    print(f"📊 Processed {self.message_count} messages (errors: {self.error_count})")
                    self.last_log_time = time.time()

                # Flush PostgreSQL candles every 30 seconds
                current_time = time.time()
                if current_time - self.last_postgres_flush > 30:
                    self.postgres_writer.flush_candles()
                    self.last_postgres_flush = current_time
                
        except KeyboardInterrupt:
            print("Received interrupt signal")
        finally:
            self.close()
    
    def _process_message(self, message) -> None:
        try:
            record = message['value']
            
            # Validate incoming data
            if not self.validator.validate_trade_record(record):
                self.error_count += 1
                if self.message_count % 1000 == 0:  # Log validation errors occasionally
                    print(f"⚠️ Invalid record skipped")
                return
            
            # Transform to internal format
            transformed_record = self.transformer.transform_trade_record(
                record, message['topic']
            )
            
            # Update Redis with current price (for Order Service)
            self._update_redis_price(transformed_record)

            # Add trade to PostgreSQL writer for OHLCV aggregation
            self.postgres_writer.add_trade(transformed_record)

            # Update live data structures
            self._update_live_data(record)

            # Add to batch for persistence (Iceberg)
            self.batch_manager.add_record(transformed_record)
            
        except Exception as e:
            self.error_count += 1
            print(f"❌ Error processing message: {e}")
    
    def _update_redis_price(self, transformed_record):
        """Update Redis with the latest price for Order Service"""
        try:
            # Get price from transformed record (it should have 'price' field)
            price = transformed_record.get('price')
            
            if price is not None:
                symbol = transformed_record.get('symbol', 'BTCUSDT')
                redis_key = f"price:{symbol}"
                
                # Convert price to string for Redis
                price_str = str(price)
                
                # Update Redis
                self.redis_client.set(redis_key, price_str)
                
                # Also store timestamp for reference
                timestamp = transformed_record.get('timestamp')
                if timestamp:
                    if isinstance(timestamp, datetime):
                        timestamp = timestamp.timestamp()
                    self.redis_client.set(f"{redis_key}:timestamp", str(timestamp))
                
                # Log occasionally (every 50 updates or every 10 seconds)
                current_time = time.time()
                if self.message_count % 50 == 0 or current_time - self.last_redis_update > 10:
                    print(f"💾 Updated Redis: {redis_key} = {price_str}")
                    self.last_redis_update = current_time
            else:
                if self.message_count % 1000 == 0:
                    print(f"⚠️ No price found in transformed record: {transformed_record.keys()}")
                    
        except Exception as e:
            if self.message_count % 1000 == 0:
                print(f"⚠️ Error updating Redis: {e}")
    
    def _update_live_data(self, record):
        # Keep existing live data logic for backward compatibility
        # This can be extracted to separate LiveDataManager later
        pass
    
    def close(self):
        print(f"\n🛑 Shutting down consumer...")
        print(f"📈 Final stats: {self.message_count} messages processed, {self.error_count} errors")
        self.postgres_writer.close()
        self.batch_manager.close()
        self.kafka_client.close()
        try:
            self.redis_client.close()
        except:
            pass

def main():
    consumer = CryptoConsumer()
    consumer.start(["btcusdt-bybit"])

if __name__ == "__main__":
    main()
