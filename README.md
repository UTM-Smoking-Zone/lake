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


## ✅ Completed Features

### Infrastructure & Core Pipeline
- [x] Real-time data ingestion from Bybit WebSocket API
- [x] Kafka streaming infrastructure (3 partitions, replication factor 1)
- [x] Kafka Producer with proper error handling and reconnection logic
- [x] Kafka Consumer with batch processing (1000 records/2min timeout)
- [x] Bronze layer Iceberg tables with Parquet compression
- [x] Docker Compose orchestration for complete stack deployment
- [x] MinIO S3-compatible warehouse with proper bucket structure
- [x] PostgreSQL Iceberg catalog with metadata management
- [x] Data validation layer (schema validation, type checking)
- [x] Data transformation layer (timestamp normalization, field mapping)
- [x] Environment-based configuration (no hardcoded credentials)
- [x] Container health checks in docker-compose.yml
- [x] Resource limits and restart policies
- [x] Diagnostic script for system health monitoring
- [x] Fixed timestamp timezone issues (timezone-naive timestamps in Iceberg)
- [x] Proper Parquet data quality (real prices, timestamps, trade sides)
- [x] Date-based partitioning in Bronze layer
- [x] ACID transactions via Iceberg

---

## 📋 Next Priorities

- [ ] Anti-monolith pattern for `kafka-consumer`
- [ ] Rework Iceberg structure
- [ ] Proper streaming architecture (Spark Structured Streaming)
- [ ] Kafka topic design
- [ ] Add schema evolution
- [ ] Bronze layer restructuring with time partitioning and 24h TTL policy
- [ ] Silver layer OHLCV schema design for multiple time intervals (1m/5m/1h/4h/1d)
- [ ] Cover codebase with tests
- [ ] Late arrivals handling mechanism with grace period logic
- [ ] REST API service with /metrics endpoints for Iceberg table queries
- [ ] Data lifecycle management policies for different retention periods
- [ ] Grafana dashboard with Prometheus metrics scraping