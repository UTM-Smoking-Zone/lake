# consumer.py (main orchestrator)
from collections import deque
from typing import List
import time
from kafka_client import KafkaClient
from data_validator import DataValidator  
from data_transformer import DataTransformer
from iceberg_writer import IcebergWriter
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
        self.batch_manager = BatchManager(
            self.batch_config, 
            self.iceberg_writer.write_batch
        )
        
        # Live data structures (keep for backward compatibility)
        self.live_graph = {}
        self.live_table = deque([], 15)
        
        # Metrics
        self.message_count = 0
        self.error_count = 0
        self.last_log_time = time.time()
    
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
            
            # Update live data structures
            self._update_live_data(record)
            
            # Add to batch for persistence
            self.batch_manager.add_record(transformed_record)
            
        except Exception as e:
            self.error_count += 1
            print(f"❌ Error processing message: {e}")
    
    def _update_live_data(self, record):
        # Keep existing live data logic for backward compatibility
        # This can be extracted to separate LiveDataManager later
        pass
    
    def close(self):
        print(f"\n🛑 Shutting down consumer...")
        print(f"📈 Final stats: {self.message_count} messages processed, {self.error_count} errors")
        self.batch_manager.close()
        self.kafka_client.close()

def main():
    consumer = CryptoConsumer()
    consumer.start(["btcusdt-bybit"])

if __name__ == "__main__":
    main()