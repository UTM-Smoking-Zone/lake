from pyspark.sql import SparkSession
from pyspark.sql.types import StructType, StructField, StringType, TimestampType, DoubleType
import requests
import time
import sys

def wait_for_spark():
    """Wait for Spark Master to be ready
    """
    max_attempts = 30

    for attempt in range(max_attempts):
        try:
            response = requests.get('http://spark-master:8080')
            if response.status_code == 200:
                print("Spark is ready")
                return True
        except requests.exceptions.ConnectionError:
            print(f"Waiting for Spark ... ({attempt + 1}/{max_attempts})")
            time.sleep(2)
    
    raise Exception("Spark failed to start")



def create_spark_session():
    return SparkSession.builder \
        .appName("IcebergTableInit") \
        .config("spark.master", "spark://spark-master:7077") \
        .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
        .config("spark.hadoop.fs.s3a.endpoint", "http://minio:9000") \
        .config("spark.hadoop.fs.s3a.access.key", "minioadmin") \
        .config("spark.hadoop.fs.s3a.secret.key", "minioadmin123") \
        .config("spark.hadoop.fs.s3a.path.style.access", "true") \
        .config("spark.jars.packages", "org.apache.iceberg:iceberg-spark-runtime-3.5_2.12:1.4.2,org.apache.hadoop:hadoop-aws:3.3.4") \
        .getOrCreate()

def create_iceberg_table(spark):
    spark.sql("""
        CREATE TABLE IF NOT EXISTS crypto_trades (
            symbol STRING,
            timestamp TIMESTAMP,
            price DOUBLE,
            volume DOUBLE,
            side STRING,
            trade_id STRING,
            source STRING
        ) USING iceberg
        LOCATION 's3a://warehouse/crypto_trades'
    """)
    print("Iceberg table created successfully")

if __name__ == "__main__":
    time.sleep(30)
    spark = create_spark_session()
    create_iceberg_table(spark)
    spark.stop()