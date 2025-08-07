from collections import deque
from datetime import datetime
import json
from typing import List, Dict

from confluent_kafka import Consumer
from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, TimestampType, DoubleType


class LiveDataConsumer:
    def __init__(self, config: dict):
        self.live_graph = {}
        self.live_graph_previous = {}
        self.live_table = deque([], 15)
        self.consumer = Consumer(config)
        self.spark = self._create_spark_session()
        self._ensure_table_exists()
        self.batch_buffer = []

    def _create_spark_session(self):
        return SparkSession.builder \
            .appName("CryptoDataConsumer") \
            .config("spark.master", "spark://spark-master:7077") \
            .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
            .config("spark.sql.catalog.lakehouse", "org.apache.iceberg.spark.SparkCatalog") \
            .config("spark.sql.catalog.lakehouse.type", "hadoop") \
            .config("spark.sql.catalog.lakehouse.warehouse", "s3a://warehouse/") \
            .config("spark.hadoop.fs.s3a.endpoint", "http://minio:9000") \
            .config("spark.hadoop.fs.s3a.access.key", "minioadmin") \
            .config("spark.hadoop.fs.s3a.secret.key", "minioadmin123") \
            .config("spark.hadoop.fs.s3a.path.style.access", "true") \
            .config("spark.jars.packages", "org.apache.iceberg:iceberg-spark-runtime-3.5_2.12:1.4.2,org.apache.hadoop:hadoop-aws:3.3.4") \
            .getOrCreate()

    # def _ensure_table_exists(self):
    #     try:
    #         self.spark.sql("""
    #             CREATE TABLE IF NOT EXISTS crypto_trades (
    #                 symbol STRING,
    #                 timestamp TIMESTAMP,
    #                 price DOUBLE,
    #                 volume DOUBLE,
    #                 side STRING,
    #                 trade_id STRING,
    #                 source STRING
    #             ) USING iceberg
    #             LOCATION 's3a://warehouse/crypto_trades'
    #             PARTITIONED BY (hour(timestamp))
    #         """)
    #     except Exception as e:
    #         print(f"Error creating table: {e}")

    def _ensure_table_exists(self):
        pass  # Таблица будет создана автоматически при первой записи

    def consume(self, topics: List[str]) -> None:
        self.consumer.subscribe(topics=topics)
        while True:
            message = self.consumer.poll(0)
            if message is None:
                continue
            key = self._key_deserializer(message.key())
            record = self._value_deserializer(message.value())
            
            self._update_live_graph_data(record)
            self._update_live_table_data(record)
            self._add_to_batch(record)

    def _add_to_batch(self, record: Dict) -> None:
        if not record:
            return
            
        batch_record = {
            'symbol': 'BTCUSDT',
            'timestamp': datetime.fromtimestamp(record.get('T')/1000),
            'price': float(record.get('p')),
            'volume': float(record.get('v')),
            'side': record.get('S'),
            'trade_id': record.get('i', ''),
            'source': 'bybit'
        }
        
        self.batch_buffer.append(batch_record)
        
        if len(self.batch_buffer) >= 100:
            self._save_to_lakehouse()

    def _save_to_lakehouse(self):
        try:
            schema = StructType([
                StructField("symbol", StringType(), True),
                StructField("timestamp", TimestampType(), True),
                StructField("price", DoubleType(), True),
                StructField("volume", DoubleType(), True),
                StructField("side", StringType(), True),
                StructField("trade_id", StringType(), True),
                StructField("source", StringType(), True)
            ])
            
            df = self.spark.createDataFrame(self.batch_buffer, schema)
            
            # Сохраняем в Parquet временно
            df.write \
                .mode("append") \
                .parquet("s3a://warehouse/crypto_trades_parquet")
            
            print(f"Saved {len(self.batch_buffer)} records to S3")
            self.batch_buffer.clear()
            
        except Exception as e:
            print(f"Error saving to S3: {e}")
            self.batch_buffer.clear()

    def close(self) -> None:
        if self.batch_buffer:
            self._save_to_lakehouse()
        self.consumer.close()
        self.spark.stop()

    def _update_live_graph_data(self, record: Dict) -> None:
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
        if not record:
            return
        data = {
            'timestamp':datetime.fromtimestamp(record.get('T')/1000).strftime('%H:%M:%S.%f')[:-3],
            'price':float(record.get('p')),
            'volume':float(record.get('v')),
            'direction':record.get('S')
        }
        self.live_table.appendleft(data)
        
    @staticmethod
    def _key_deserializer(key: bytes) -> str:
        return str(key.decode('utf-8'))

    @staticmethod
    def _value_deserializer(value: bytes) -> Dict:
        return json.loads(value.decode('utf-8'))


def main():
   config = {
       'bootstrap.servers': 'kafka:9092',
       'group.id': 'crypto-data-consumer',
       'auto.offset.reset': 'latest'
   }
   
   consumer = LiveDataConsumer(config)
   try:
       consumer.consume(['btcusdt-bybit'])
   except KeyboardInterrupt:
       print("Stopping consumer...")
   finally:
       consumer.close()


if __name__ == '__main__':
   main()