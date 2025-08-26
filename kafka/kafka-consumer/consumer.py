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
from pyiceberg.types import NestedField, StringType, TimestampType, DoubleType, DateType
from pyiceberg.exceptions import CommitFailedException

import pyarrow as pa
import pyarrow.parquet as pq


class KafkaConsumer:
    def __init__(self, config: dict):
        self.live_graph = {}
        self.live_graph_previous = {}
        self.live_table = deque([], 15)
        self.consumer = Consumer(config)
        self.catalog = self._create_catalog()
        self.table = self._create_iceberg_table()

        self.batch_buffer = []
        self.batch_size = 50000  # Уменьшили batch размер
        self.batch_timeout = 600
        self.last_save_time = time.time()
        self.buffer_lock = threading.Lock()
        self.max_retries = 3  # Добавили retry параметр

        self.compression_settings = {
            "compression": "zstd",
            "compression_level": 6,
            "use_dictionary": True,
            "dictionary_pagesize_limit": 1024 * 1024,
            "write_statistics": True,
            "row_group_size": 100000,
            "data_page_size": 2 * 1024 * 1024,
            "write_batch_size": 10000,
            "use_deprecated_int96_timestamps": False,
            "coerce_timestamps": "ms",
            "store_schema": False,
        }

        self.compression_stats = {
            "files_written": 0,
            "total_records": 0,
            "total_compressed_size": 0,
            "total_uncompressed_size": 0,
        }

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
                "s3.path-style-access": "true",
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
                NestedField(5, "side", StringType()),
                NestedField(7, "source", StringType()),
                NestedField(6, "trade_id", StringType()),

                NestedField(2, "timestamp", TimestampType()),
                NestedField(8, "processing_time", TimestampType()),
                NestedField(9, "date_partition", DateType()),

                NestedField(3, "price", DoubleType()),
                NestedField(4, "volume", DoubleType()),
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
                table = self.catalog.create_table("bronze.crypto_trades", schema=schema)
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
        print(f"Compression: {self.compression_settings['compression']} level {self.compression_settings['compression_level']}")
        print(f"Batch settings: {self.batch_size} records, {self.batch_timeout}s timeout")
        
        # Start periodic save thread
        save_thread = threading.Thread(target=self._periodic_save, daemon=True)
        save_thread.start()

        stats_thread = threading.Thread(target=self._compression_stats_reporter, daemon=True)
        stats_thread.start()

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
            symbol = topic.split("-")[0].upper() if "-" in topic else "BTCUSDT"
            trade_timestamp = datetime.fromtimestamp(record.get("T", 0) / 1000)

            batch_record = {
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

            with self.buffer_lock:
                self.batch_buffer.append(batch_record)

                should_save = False
                reason = ""

                if len(self.batch_buffer) >= self.batch_size:
                    should_save = True
                    reason = f"batch_size ({len(self.batch_buffer): }, records)"
                    # self._save_to_iceberg()

                if should_save:
                    print(f"Triggering save: {reason}")
                    self._save_to_iceberg_compressed()

        except Exception as e:
            print(f"Error adding to batch: {e}")

    def _periodic_save(self):
        """Background thread for periodic saves"""
        while True:
            time.sleep(60)

            current_time = time.time()
            with self.buffer_lock:
                if (self.batch_buffer and 
                   current_time - self.last_save_time > self.batch_timeout):
                   buffer_size = len(self.batch_buffer)
                   print(f"Timeout save: {buffer_size} records")
                   self._save_to_iceberg_compressed()
                
    def _save_to_iceberg_compressed(self):
        """Save batch to Iceberg table using PyArrow with retry mechanism"""
        if not self.batch_buffer:
            return

        # Создаем копию буфера для retry логики
        records_to_save = self.batch_buffer.copy()
        save_start_time = time.time()

        print(f"Starting compressed save: {len(records_to_save)}, records")

        for attempt in range(self.max_retries):
            try:
                self.table.refresh()

                records_to_save.sort(key=lambda x: (x['timestamp'], x['symbol'], x['side']))

                # Convert batch to PyArrow table
                # arrow_table = pa.Table.from_pydict(
                #     {
                #         "symbol": [row["symbol"] for row in records_to_save],
                #         "timestamp": [row["timestamp"] for row in records_to_save],
                #         "price": [row["price"] for row in records_to_save],
                #         "volume": [row["volume"] for row in records_to_save],
                #         "side": [row["side"] for row in records_to_save],
                #         "trade_id": [row["trade_id"] for row in records_to_save],
                #         "source": [row["source"] for row in records_to_save],
                #         "processing_time": [
                #             row["processing_time"] for row in records_to_save
                #         ],
                #         "date_partition": [
                #             row["date_partition"] for row in records_to_save
                #         ],
                #     }
                # )

                arrow_table = pa.Table.from_pydict({
                   # Строки с dictionary encoding
                   'symbol': pa.array([row['symbol'] for row in records_to_save], 
                                    type=pa.dictionary(pa.int8(), pa.string())),
                   'side': pa.array([row['side'] for row in records_to_save],
                                  type=pa.dictionary(pa.int8(), pa.string())),
                   'source': pa.array([row['source'] for row in records_to_save],
                                    type=pa.dictionary(pa.int8(), pa.string())),
                   'trade_id': [row['trade_id'] for row in records_to_save],
                   
                   # Временные поля
                   'timestamp': [row['timestamp'] for row in records_to_save],
                   'processing_time': [row['processing_time'] for row in records_to_save],
                   'date_partition': [row['date_partition'] for row in records_to_save],
                   
                   # Численные поля
                   'price': [row['price'] for row in records_to_save],
                   'volume': [row['volume'] for row in records_to_save],
                })
                
                import tempfile
                import os
                
                with tempfile.NamedTemporaryFile(suffix='.parquet', delete=False) as tmp_file:
                    # Записываем с максимальным сжатием
                    pq.write_table(
                        arrow_table, 
                        tmp_file.name,
                        **self.compression_settings
                    )
                    
                    # Получаем размер сжатого файла
                    compressed_size = os.path.getsize(tmp_file.name)
                    
                    # Читаем обратно для Iceberg
                    compressed_table = pq.read_table(tmp_file.name)
                    
                    # Удаляем временный файл
                    os.unlink(tmp_file.name)


                # Append to Iceberg table
                # self.table.append(arrow_table)
                self.table.append(compressed_table)

                uncompressed_size = len(records_to_save) * 150  # ~150 bytes per record
                compression_ratio = uncompressed_size / compressed_size if compressed_size > 0 else 1
               
                save_duration = time.time() - save_start_time

                print(f"✅ COMPRESSED SAVE SUCCESS:")
                print(f"   📝 Records: {len(records_to_save)}")
                print(f"   ⏱️  Time: {save_duration:.1f}s")
                print(f"   📦 Size: {compressed_size / 1024 / 1024:.1f}MB")
                print(f"   🗜️  Ratio: {compression_ratio:.1f}x compression")
                print(f"   💾 Savings: {(uncompressed_size - compressed_size) / 1024 / 1024:.1f}MB saved")

                print(
                    f"✅ Successfully saved {len(records_to_save)} records to Iceberg Bronze layer"
                )

                self.compression_stats['files_written'] += 1
                self.compression_stats['total_records'] += len(records_to_save)
                self.compression_stats['total_compressed_size'] += compressed_size
                self.compression_stats['total_uncompressed_size'] += uncompressed_size

                # Успешно сохранили - очищаем буфер
                self.batch_buffer.clear()
                self.last_save_time = time.time()
                return

            except CommitFailedException as e:
                if "branch main has changed" in str(e):
                    if attempt < self.max_retries - 1:
                        # Exponential backoff with jitter
                        wait_time = (2**attempt) + random.uniform(0, 1)
                        print(
                            f"⚠️ Commit conflict detected, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{self.max_retries})"
                        )
                        time.sleep(wait_time)
                        continue
                    else:
                        print(
                            f"❌ Failed to save after {self.max_retries} attempts due to conflicts"
                        )
                else:
                    print(f"❌ CommitFailedException (non-conflict): {e}")
                    break

            except Exception as e:
                print(f"❌ Error saving to Iceberg: {e}")
                break

        # Если дошли сюда - не удалось сохранить, очищаем буфер чтобы не зациклиться
        print(
            f"⚠️ Clearing {len(self.batch_buffer)} records from buffer due to save failure"
        )
        self.batch_buffer.clear()

    def _compression_stats_reporter(self):
        while True:
            time.sleep(300)

            stats = self.compression_stats

            if stats['files_written'] > 0:
                avg_compression = (stats['total_uncompressed_size'] / stats['total_compressed_size']) if stats['total_compressed_size'] > 0 else 1
                total_saved_mb = (stats['total_uncompressed_size'] - stats['total_compressed_size']) / 1024 / 1024

                print(f"\n📊 COMPRESSION STATS:")
                print(f"   📁 Files written: {stats['files_written']}")
                print(f"   📝 Total records: {stats['total_records']}")
                print(f"   🗜️  Avg compression: {avg_compression:.1f}x")
                print(f"   💾 Space saved: {total_saved_mb:.1f}MB")
                print(f"   📦 Compressed size: {stats['total_compressed_size'] / 1024 / 1024:.1f}MB")

    def close(self) -> None:
        """Clean shutdown"""
        print("Closing consumer...")

        with self.buffer_lock:
            if self.batch_buffer:
                print(f"Final save: {len(self.batch_buffer)} records")
                self._save_to_iceberg_compressed()

        stats = self.compression_stats
        if stats['files_written'] > 0:
            avg_compression = stats['total_uncompressed_size'] / max(stats['total_compressed_size'], 1)
            total_saved_gb = (stats['total_uncompressed_size'] - stats['total_compressed_size']) / 1024 / 1024 / 1024
            
            print(f"\n🏁 FINAL COMPRESSION REPORT:")
            print(f"   📁 Total files: {stats['files_written']}")
            print(f"   📝 Total records: {stats['total_records']}")
            print(f"   🗜️  Overall compression: {avg_compression:.1f}x")
            print(f"   💾 Total space saved: {total_saved_gb:.2f}GB")

        self.consumer.close()
        print("Consumer closed successfully")

    def _update_live_graph_data(self, record: Dict) -> None:
        """Update live graph data for real-time visualization"""
        if not record:
            return

        current_ts = datetime.fromtimestamp(record.get("T") / 1000).replace(
            second=0, microsecond=0
        )
        previous_ts = self.live_graph.get("timestamp")
        current_price = float(record.get("p"))
        current_volume = float(record.get("v"))

        if previous_ts and current_ts.minute == previous_ts.minute:
            self.live_graph["high"] = max(self.live_graph.get("high", 0), current_price)
            self.live_graph["low"] = min(self.live_graph.get("low", 0), current_price)
            self.live_graph["volume"] += current_volume
        else:
            self.live_graph_previous = self.live_graph.copy()
            self.live_graph["open"] = current_price
            self.live_graph["high"] = current_price
            self.live_graph["low"] = current_price
            self.live_graph["volume"] = 0

        self.live_graph["timestamp"] = current_ts
        self.live_graph["close"] = current_price

    def _update_live_table_data(self, record: Dict) -> None:
        """Update live table data for recent trades display"""
        if not record:
            return

        data = {
            "timestamp": datetime.fromtimestamp(record.get("T") / 1000).strftime(
                "%H:%M:%S.%f"
            )[:-3],
            "price": float(record.get("p")),
            "volume": float(record.get("v")),
            "direction": record.get("S"),
        }
        self.live_table.appendleft(data)

    @staticmethod
    def _key_deserializer(key: bytes) -> str:
        return str(key.decode("utf-8")) if key else ""

    @staticmethod
    def _value_deserializer(value: bytes) -> Dict:
        return json.loads(value.decode("utf-8"))


def main():
    config = {
        "bootstrap.servers": "kafka:9092",
        "group.id": "crypto-iceberg-consumer-v3-compressed",  # Изменили group ID
        "auto.offset.reset": "latest",
        "enable.auto.commit": True,
        "auto.commit.interval.ms": 1000,
    }

    print("Starting Iceberg Data Consumer with max compression ...")

    try:
        consumer = KafkaConsumer(config)
        consumer.consume(["btcusdt-bybit"])
    except KeyboardInterrupt:
        print("Stopping consumer...")
    except Exception as e:
        print(f"Fatal error: {e}")
    finally:
        if "consumer" in locals():
            consumer.close()


if __name__ == "__main__":
    main()
