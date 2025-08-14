from collections import deque
from datetime import datetime, date
import json
import time
import threading
import random
from typing import List, Dict

from confluent_kafka import Consumer
from pyiceberg.catalog import load_catalog
from pyiceberg.schema import Schema
from pyiceberg.types import (
   NestedField, StringType, TimestampType, DoubleType, DateType
)
from pyiceberg.exceptions import CommitFailedException
import pyarrow as pa


class KafkaConsumer:
   def __init__(self, config: dict):
       self.live_graph = {}
       self.live_graph_previous = {}
       self.live_table = deque([], 15)
       self.consumer = Consumer(config)
       self.catalog = self._create_catalog()
       self.table = self._create_iceberg_table()
       self.batch_buffer = []
       self.batch_size = 50  # Уменьшили batch размер
       self.batch_timeout = 30
       self.last_save_time = time.time()
       self.buffer_lock = threading.Lock()
       self.max_retries = 5  # Добавили retry параметр

   def _create_catalog(self):
       """Create PyIceberg catalog connection"""
       try:
           catalog = load_catalog("default", **{
               "type": "sql",
               "uri": "postgresql://admin:admin123@postgres:5432/lakehouse",
               "warehouse": "s3://warehouse/",
               "s3.endpoint": "http://minio:9000",
               "s3.access-key-id": "minioadmin",
               "s3.secret-access-key": "minioadmin123",
               "s3.path-style-access": "true"
           })
           print("Iceberg catalog created successfully")
           
           # Debug: list what's in the catalog
           try:
               namespaces = catalog.list_namespaces()
               print(f"Available namespaces: {namespaces}")
           except Exception as e:
               print(f"Could not list namespaces: {e}")
               
           return catalog
       except Exception as e:
           print(f"Error creating catalog: {e}")
           raise

   def _create_iceberg_table(self):
       """Create Iceberg table with proper namespace handling"""
       try:
           # Define schema
           schema = Schema(
               NestedField(1, "symbol", StringType()),
               NestedField(2, "timestamp", TimestampType()),
               NestedField(3, "price", DoubleType()),
               NestedField(4, "volume", DoubleType()),
               NestedField(5, "side", StringType()),
               NestedField(6, "trade_id", StringType()),
               NestedField(7, "source", StringType()),
               NestedField(8, "processing_time", TimestampType()),
               NestedField(9, "date_partition", DateType()),
           )
           
           # First check if table exists
           try:
               table = self.catalog.load_table("bronze.crypto_trades")
               print("Loaded existing Iceberg table")
               return table
           except Exception as e:
               print(f"Table doesn't exist, will create: {e}")
           
           # List existing namespaces
           try:
               namespaces = self.catalog.list_namespaces()
               print(f"Existing namespaces: {namespaces}")
           except Exception as e:
               print(f"Could not list namespaces: {e}")
           
           # Create bronze namespace if needed
           try:
               if ("bronze",) not in self.catalog.list_namespaces():
                   self.catalog.create_namespace("bronze")
                   print("Created 'bronze' namespace")
               else:
                   print("Namespace 'bronze' already exists")
           except Exception as e:
               print(f"Namespace creation issue: {e}")
           
           # Create the table
           try:
               table = self.catalog.create_table(
                   "bronze.crypto_trades",
                   schema=schema
               )
               print("Created new Iceberg table successfully")
               return table
               
           except Exception as e:
               print(f"Error creating table: {e}")
               # List tables to debug
               try:
                   tables = self.catalog.list_tables("bronze")
                   print(f"Tables in bronze: {tables}")
               except Exception as list_error:
                   print(f"Could not list tables: {list_error}")
               raise
               
       except Exception as e:
           print(f"Fatal error with Iceberg table setup: {e}")
           raise

   def consume(self, topics: List[str]) -> None:
       """Main consumption loop"""
       self.consumer.subscribe(topics=topics)
       print(f"Subscribed to topics: {topics}")
       
       # Start periodic save thread
       save_thread = threading.Thread(target=self._periodic_save, daemon=True)
       save_thread.start()
       
       try:
           while True:
               message = self.consumer.poll(1.0)
               if message is None:
                   continue
                   
               if message.error():
                   print(f"Consumer error: {message.error()}")
                   continue
                   
               try:
                   key = self._key_deserializer(message.key())
                   record = self._value_deserializer(message.value())
                   
                   # Update live data structures
                   self._update_live_graph_data(record)
                   self._update_live_table_data(record)
                   
                   # Add to batch for Iceberg
                   self._add_to_batch(record, message.topic())
                   
               except Exception as e:
                   print(f"Error processing message: {e}")
                   continue
                   
       except KeyboardInterrupt:
           print("Received interrupt signal")
       finally:
           self.close()

   def _add_to_batch(self, record: Dict, topic: str) -> None:
       """Add record to batch for Iceberg storage"""
       if not record:
           return
           
       try:
           # Extract symbol from topic
           symbol = topic.split('-')[0].upper() if '-' in topic else 'BTCUSDT'
           trade_timestamp = datetime.fromtimestamp(record.get('T', 0) / 1000)
           
           batch_record = {
               'symbol': symbol,
               'timestamp': trade_timestamp,
               'price': float(record.get('p', 0)),
               'volume': float(record.get('v', 0)),
               'side': record.get('S', 'UNKNOWN'),
               'trade_id': str(record.get('i', '')),
               'source': 'bybit',
               'processing_time': datetime.now(),
               'date_partition': trade_timestamp.date()
           }
           
           with self.buffer_lock:
               self.batch_buffer.append(batch_record)
               
               if len(self.batch_buffer) >= self.batch_size:
                   self._save_to_iceberg()
                   
       except Exception as e:
           print(f"Error adding to batch: {e}")

   def _periodic_save(self):
       """Background thread for periodic saves"""
       while True:
           time.sleep(5)
           
           current_time = time.time()
           with self.buffer_lock:
               if (self.batch_buffer and 
                   current_time - self.last_save_time > self.batch_timeout):
                   print(f"Timeout save: {len(self.batch_buffer)} records")
                   self._save_to_iceberg()

   def _save_to_iceberg(self):
       """Save batch to Iceberg table using PyArrow with retry mechanism"""
       if not self.batch_buffer:
           return
           
       # Создаем копию буфера для retry логики
       records_to_save = self.batch_buffer.copy()
       
       for attempt in range(self.max_retries):
           try:
               print(f"Saving {len(records_to_save)} records to Iceberg... (attempt {attempt + 1})")
               
               # Refresh table metadata before each attempt
               self.table.refresh()
               
               # Convert batch to PyArrow table
               arrow_table = pa.Table.from_pydict({
                   'symbol': [row['symbol'] for row in records_to_save],
                   'timestamp': [row['timestamp'] for row in records_to_save],
                   'price': [row['price'] for row in records_to_save],
                   'volume': [row['volume'] for row in records_to_save],
                   'side': [row['side'] for row in records_to_save],
                   'trade_id': [row['trade_id'] for row in records_to_save],
                   'source': [row['source'] for row in records_to_save],
                   'processing_time': [row['processing_time'] for row in records_to_save],
                   'date_partition': [row['date_partition'] for row in records_to_save]
               })
               
               # Append to Iceberg table
               self.table.append(arrow_table)
               
               print(f"✅ Successfully saved {len(records_to_save)} records to Iceberg Bronze layer")
               
               # Успешно сохранили - очищаем буфер
               self.batch_buffer.clear()
               self.last_save_time = time.time()
               return
               
           except CommitFailedException as e:
               if "branch main has changed" in str(e):
                   if attempt < self.max_retries - 1:
                       # Exponential backoff with jitter
                       wait_time = (2 ** attempt) + random.uniform(0, 1)
                       print(f"⚠️ Commit conflict detected, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{self.max_retries})")
                       time.sleep(wait_time)
                       continue
                   else:
                       print(f"❌ Failed to save after {self.max_retries} attempts due to conflicts")
               else:
                   print(f"❌ CommitFailedException (non-conflict): {e}")
                   break
                   
           except Exception as e:
               print(f"❌ Error saving to Iceberg: {e}")
               break
               
       # Если дошли сюда - не удалось сохранить, очищаем буфер чтобы не зациклиться
       print(f"⚠️ Clearing {len(self.batch_buffer)} records from buffer due to save failure")
       self.batch_buffer.clear()

   def close(self) -> None:
       """Clean shutdown"""
       print("Closing consumer...")
       
       with self.buffer_lock:
           if self.batch_buffer:
               print(f"Final save: {len(self.batch_buffer)} records")
               self._save_to_iceberg()
       
       self.consumer.close()
       print("Consumer closed successfully")

   def _update_live_graph_data(self, record: Dict) -> None:
       """Update live graph data for real-time visualization"""
       if not record:
           return

       current_ts = datetime.fromtimestamp(record.get('T')/1000).replace(second=0, microsecond=0)
       previous_ts = self.live_graph.get('timestamp')
       current_price = float(record.get('p'))
       current_volume = float(record.get('v'))
       
       if previous_ts and current_ts.minute == previous_ts.minute:
           self.live_graph['high'] = max(self.live_graph.get('high', 0), current_price)
           self.live_graph['low'] = min(self.live_graph.get('low', 0), current_price)
           self.live_graph['volume'] += current_volume 
       else:
           self.live_graph_previous = self.live_graph.copy()
           self.live_graph['open'] = current_price
           self.live_graph['high'] = current_price
           self.live_graph['low'] = current_price
           self.live_graph['volume'] = 0

       self.live_graph['timestamp'] = current_ts
       self.live_graph['close'] = current_price

   def _update_live_table_data(self, record: Dict) -> None:
       """Update live table data for recent trades display"""
       if not record:
           return
           
       data = {
           'timestamp': datetime.fromtimestamp(record.get('T')/1000).strftime('%H:%M:%S.%f')[:-3],
           'price': float(record.get('p')),
           'volume': float(record.get('v')),
           'direction': record.get('S')
       }
       self.live_table.appendleft(data)
       
   @staticmethod
   def _key_deserializer(key: bytes) -> str:
       return str(key.decode('utf-8')) if key else ""

   @staticmethod
   def _value_deserializer(value: bytes) -> Dict:
       return json.loads(value.decode('utf-8'))


def main():
   config = {
       'bootstrap.servers': 'kafka:9092',
       'group.id': 'crypto-iceberg-consumer-v2',  # Изменили group ID
       'auto.offset.reset': 'latest',
       'enable.auto.commit': True,
       'auto.commit.interval.ms': 1000
   }
   
   print("Starting Iceberg Data Consumer...")
   
   try:
       consumer = KafkaConsumer(config)
       consumer.consume(['btcusdt-bybit'])
   except KeyboardInterrupt:
       print("Stopping consumer...")
   except Exception as e:
       print(f"Fatal error: {e}")
   finally:
       if 'consumer' in locals():
           consumer.close()


if __name__ == '__main__':
   main()