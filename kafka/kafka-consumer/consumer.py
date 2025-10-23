# config.py
from dataclasses import dataclass
from typing import Dict

from config import *

@dataclass
class KafkaConfig:
    bootstrap_servers: str = "kafka:9092"
    group_id: str = "crypto-iceberg-consumer-v3-compressed"
    auto_offset_reset: str = "latest"
    enable_auto_commit: bool = True
    auto_commit_interval_ms: int = 1000

@dataclass
class IcebergConfig:
    catalog_uri: str = "postgresql://admin:admin123@postgres:5432/lakehouse"
    warehouse: str = "s3://warehouse/"
    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin123"

@dataclass
class BatchConfig:
    batch_size: int = 50000
    batch_timeout: int = 600
    max_retries: int = 3

@dataclass
class CompressionConfig:
    compression: str = "zstd"
    compression_level: int = 6
    use_dictionary: bool = True
    row_group_size: int = 100000

# kafka_client.py
from confluent_kafka import Consumer
from typing import List, Optional, Dict
import json

class KafkaClient:
    def __init__(self, config: KafkaConfig):
        self.consumer = Consumer(config.__dict__)
        
    def subscribe(self, topics: List[str]) -> None:
        self.consumer.subscribe(topics=topics)
        print(f"Subscribed to topics: {topics}")
    
    def poll_message(self, timeout: float = 1.0) -> Optional[Dict]:
        message = self.consumer.poll(timeout)
        if message is None:
            return None
            
        if message.error():
            print(f"Consumer error: {message.error()}")
            return None
            
        return {
            'key': self._deserialize_key(message.key()),
            'value': self._deserialize_value(message.value()),
            'topic': message.topic()
        }
    
    def close(self) -> None:
        self.consumer.close()
        print("Kafka consumer closed")
    
    @staticmethod
    def _deserialize_key(key: bytes) -> str:
        return str(key.decode("utf-8")) if key else ""
    
    @staticmethod
    def _deserialize_value(value: bytes) -> Dict:
        return json.loads(value.decode("utf-8"))

# data_validator.py
from typing import Dict, Optional

class DataValidator:
    REQUIRED_FIELDS = ['T', 'p', 'v', 'S']
    VALID_SIDES = ['Buy', 'Sell']
    
    @classmethod
    def validate_trade_record(cls, record: Dict) -> bool:
        if not cls._has_required_fields(record):
            return False
            
        if not cls._validate_field_types(record):
            return False
            
        if not cls._validate_side(record):
            return False
            
        return True
    
    @classmethod
    def _has_required_fields(cls, record: Dict) -> bool:
        return all(field in record for field in cls.REQUIRED_FIELDS)
    
    @classmethod
    def _validate_field_types(cls, record: Dict) -> bool:
        try:
            float(record['p'])  # price
            float(record['v'])  # volume  
            int(record['T'])    # timestamp
            return True
        except (ValueError, TypeError):
            return False
    
    @classmethod
    def _validate_side(cls, record: Dict) -> bool:
        return record.get('S') in cls.VALID_SIDES

# data_transformer.py
from datetime import datetime
from typing import Dict

class DataTransformer:
    @staticmethod
    def transform_trade_record(record: Dict, topic: str) -> Dict:
        symbol = DataTransformer._extract_symbol(topic)
        trade_timestamp = DataTransformer._convert_timestamp(record.get("T", 0))
        
        return {
            "symbol": symbol,
            "side": record.get("S", "UNKNOWN"),
            "source": "bybit",
            "trade_id": str(record.get("i", "")),
            "timestamp": trade_timestamp,
            "processing_time": datetime.now().replace(microsecond=0),
            "date_partition": trade_timestamp.date(),
            "price": float(record.get("p", 0)),
            "volume": float(record.get("v", 0)),
        }
    
    @staticmethod
    def _extract_symbol(topic: str) -> str:
        return topic.split("-")[0].upper() if "-" in topic else "BTCUSDT"
    
    @staticmethod
    def _convert_timestamp(timestamp_ms: int) -> datetime:
        return datetime.fromtimestamp(timestamp_ms / 1000)

# iceberg_writer.py  
from pyiceberg.catalog import load_catalog
from pyiceberg.schema import Schema
from pyiceberg.types import NestedField, StringType, TimestampType, DoubleType, DateType
from pyiceberg.partitioning import PartitionSpec, PartitionField
from pyiceberg.transforms import IdentityTransform
from pyiceberg.exceptions import CommitFailedException
import pyarrow as pa
import time
import random

class IcebergWriter:
    def __init__(self, config: IcebergConfig):
        self.catalog = self._create_catalog(config)
        self.table = self._create_table()
        
    def _create_catalog(self, config: IcebergConfig):
        catalog = load_catalog("default", **{
            "type": "sql",
            "uri": config.catalog_uri,
            "warehouse": config.warehouse,
            "s3.endpoint": config.s3_endpoint,
            "s3.access-key-id": config.s3_access_key,
            "s3.secret-access-key": config.s3_secret_key,
            "s3.path-style-access": "true",
        })
        print("Iceberg catalog created successfully")
        return catalog
        
    def _create_table(self):
        schema = Schema(
            NestedField(1, "symbol", StringType()),
            NestedField(5, "side", StringType()),
            NestedField(7, "source", StringType()),
            NestedField(6, "trade_id", StringType()),
            NestedField(2, "timestamp", TimestampType()),
            NestedField(8, "processing_time", TimestampType()),
            NestedField(9, "date_partition", DateType()),
            NestedField(3, "price", DoubleType()),
            NestedField(4, "volume", DoubleType()),
        )
        
        partition_spec = PartitionSpec([
            PartitionField(
                source_id=9,
                field_id=1000,
                transform=IdentityTransform(),
                name="date_partition"
            )
        ])
        
        try:
            table = self.catalog.load_table("bronze.crypto_trades")
            print("Loaded existing Iceberg table")
        except Exception:
            # Create namespace if needed
            if ("bronze",) not in self.catalog.list_namespaces():
                self.catalog.create_namespace("bronze")
            
            table = self.catalog.create_table(
                "bronze.crypto_trades",
                schema=schema,
                partition_spec=partition_spec
            )
            print("Created new Iceberg table")
            
        return table
    
    def write_batch(self, records, max_retries=3):
        if not records:
            return
            
        for attempt in range(max_retries):
            try:
                self.table.refresh()
                records.sort(key=lambda x: (x['timestamp'], x['symbol'], x['side']))
                
                arrow_table = self._create_arrow_table(records)
                self.table.append(arrow_table)
                
                print(f"Successfully saved {len(records)} records to Iceberg")
                return
                
            except CommitFailedException as e:
                if "branch main has changed" in str(e) and attempt < max_retries - 1:
                    wait_time = (2**attempt) + random.uniform(0, 1)
                    print(f"Commit conflict, retrying in {wait_time:.1f}s")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"Failed to save after {max_retries} attempts")
                    break
                    
            except Exception as e:
                print(f"Error saving to Iceberg: {e}")
                break
    
    def _create_arrow_table(self, records):
        return pa.Table.from_pydict({
            'symbol': pa.array([row['symbol'] for row in records], 
                             type=pa.dictionary(pa.int8(), pa.string())),
            'side': pa.array([row['side'] for row in records],
                           type=pa.dictionary(pa.int8(), pa.string())),
            'source': pa.array([row['source'] for row in records],
                             type=pa.dictionary(pa.int8(), pa.string())),
            'trade_id': pa.array([row['trade_id'] for row in records]),
            'timestamp': pa.array([row['timestamp'] for row in records]),
            'processing_time': pa.array([row['processing_time'] for row in records]),
            'date_partition': pa.array([row['date_partition'] for row in records]),
            'price': pa.array([row['price'] for row in records], type=pa.float64()),
            'volume': pa.array([row['volume'] for row in records], type=pa.float64()),
        })

# batch_manager.py
import threading
import time
from typing import List, Dict, Callable

class BatchManager:
    def __init__(self, config: BatchConfig, write_callback: Callable):
        self.batch_size = config.batch_size
        self.batch_timeout = config.batch_timeout
        self.write_callback = write_callback
        
        self.buffer = []
        self.buffer_lock = threading.Lock()
        self.last_save_time = time.time()
        
        # Start background thread for timeout-based saves
        self.timeout_thread = threading.Thread(target=self._timeout_saver, daemon=True)
        self.timeout_thread.start()
    
    def add_record(self, record: Dict) -> None:
        with self.buffer_lock:
            self.buffer.append(record)
            
            if len(self.buffer) >= self.batch_size:
                self._flush_buffer("batch_size")
    
    def _flush_buffer(self, reason: str) -> None:
        if not self.buffer:
            return
            
        print(f"Triggering save: {reason} ({len(self.buffer)} records)")
        records_to_save = self.buffer.copy()
        self.buffer.clear()
        self.last_save_time = time.time()
        
        # Write in separate thread to avoid blocking main loop
        write_thread = threading.Thread(
            target=self.write_callback,
            args=(records_to_save,)
        )
        write_thread.start()
    
    def _timeout_saver(self):
        while True:
            time.sleep(60)
            
            with self.buffer_lock:
                current_time = time.time()
                if (self.buffer and 
                    current_time - self.last_save_time > self.batch_timeout):
                    self._flush_buffer("timeout")
    
    def close(self):
        with self.buffer_lock:
            if self.buffer:
                self._flush_buffer("shutdown")

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
    
    def start(self, topics: List[str]) -> None:
        self.kafka_client.subscribe(topics)
        
        try:
            while True:
                message = self.kafka_client.poll_message()
                if message is None:
                    continue
                
                self._process_message(message)
                
        except KeyboardInterrupt:
            print("Received interrupt signal")
        finally:
            self.close()
    
    def _process_message(self, message) -> None:
        try:
            record = message['value']
            
            # Validate incoming data
            if not self.validator.validate_trade_record(record):
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
            print(f"Error processing message: {e}")
    
    def _update_live_data(self, record):
        # Keep existing live data logic for backward compatibility
        # This can be extracted to separate LiveDataManager later
        pass
    
    def close(self):
        print("Shutting down consumer...")
        self.batch_manager.close()
        self.kafka_client.close()

def main():
    consumer = CryptoConsumer()
    consumer.start(["btcusdt-bybit"])

if __name__ == "__main__":
    main()