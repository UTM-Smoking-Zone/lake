"""
Ingestion Service - Consumes from Kafka and writes to Iceberg
Separated from monolithic consumer for microservice architecture
"""
import sys
import os
from collections import deque
from typing import List
import time

# Import from existing kafka-consumer code
sys.path.append('/kafka-consumer')

from kafka_client import KafkaClient
from data_validator import DataValidator  
from data_transformer import DataTransformer
from iceberg_writer import IcebergWriter
from batch_manager import BatchManager
from config import KafkaConfig, IcebergConfig, BatchConfig

class IngestionService:
    """Microservice for data ingestion from Kafka to Iceberg"""
    
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
        
        # Metrics
        self.message_count = 0
        self.error_count = 0
        self.last_log_time = time.time()
        
        print("✅ Ingestion Service initialized")
    
    def start(self, topics: List[str]) -> None:
        """Start consuming from Kafka topics"""
        self.kafka_client.subscribe(topics)
        print(f"🚀 Ingestion Service started, processing messages from {topics}...")
        
        try:
            while True:
                message = self.kafka_client.poll_message()
                if message is None:
                    # Heartbeat every 10 seconds if no messages
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
        """Process single Kafka message"""
        try:
            record = message['value']
            
            # Validate incoming data
            if not self.validator.validate_trade_record(record):
                self.error_count += 1
                if self.message_count % 1000 == 0:
                    print(f"⚠️ Invalid record skipped")
                return
            
            # Transform to internal format
            transformed_record = self.transformer.transform_trade_record(
                record, message['topic']
            )
            
            # Add to batch for persistence
            self.batch_manager.add_record(transformed_record)
            
        except Exception as e:
            self.error_count += 1
            print(f"❌ Error processing message: {e}")
    
    def close(self):
        """Graceful shutdown"""
        print(f"\n🛑 Shutting down Ingestion Service...")
        print(f"📈 Final stats: {self.message_count} messages processed, {self.error_count} errors")
        self.batch_manager.close()
        self.kafka_client.close()

def main():
    service = IngestionService()
    topics = os.getenv("KAFKA_TOPICS", "btcusdt-bybit").split(",")
    service.start(topics)

if __name__ == "__main__":
    main()
