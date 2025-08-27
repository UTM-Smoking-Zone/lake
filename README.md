# Trading Data Lakehouse

Real-time cryptocurrency data pipeline with Kafka, Iceberg, and Spark.

## Architecture

- **Data Source**: Bybit WebSocket API streaming 
- **Message Queue**: Apache Kafka with robust producer/consumer architecture
- **Storage Layer**: Apache Iceberg tables with ZSTD compression ACID transactions
- **Object Storage**: MinIO S3-compatible warehouse with optimized storage
- **Catalog**: PostgreSQL metadata store for Iceberg table management
- **Compression**: Parquet compression with 5.8x space reduction
- **Monitoring**: Kafka UI (8090), Spark UI (8080), MinIO Console (9001)

## Status

- **2.48M+ records** succesfully ingested and stored
- **Zero data loss** with automatic retry mechanisms and conflict resolution


## Completed Features

**Completed**
- Real-time data ingestion from Bybit API
- Kafka streaming infrastructure with comprehensive error handling
- Bronze layer Iceberg tables with optimized Parquet compression
- Docker Compose orchestration for complete stack deployment
- Consumer lag monitoring and error handling
- MinIO warehouse with proper bucket structure
- PostgreSQL Iceberg catalog with 15k+ snapshots

**Next**

- Bronze layer restructuring with time partitioning and 24h TTL policy
- Silver layer OHLCV schema design for multiple time intervals (1m/5m/1h/4h/1d)  
- Basic Airflow DAG for 5-minute OHLCV aggregation and performance testing
- Cover codebase with tests
- Late arrivals handling mechanism with grace period logic
- Multi-interval Airflow DAGs with proper task dependencies
- REST API service with /metrics endpoints for Iceberg table queries
- Data lifecycle management policies for different retention periods
- Airflow DAGs for historical data backfill from exchange REST APIs
- Grafana dashboard with Prometheus metrics scraping
