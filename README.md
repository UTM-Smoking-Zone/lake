# Trading Data Lakehouse

Real-time crypto data pipeline: Kafka → Iceberg → MinIO

## Stack

- **Ingestion**: Bybit WebSocket → Kafka (3 partitions)
- **Storage**: Iceberg tables (Parquet + ZSTD) on MinIO S3
- **Catalog**: PostgreSQL metadata
- **Monitoring**: Kafka UI :8090, MinIO Console :9001

## Status

- [x] **2M+ records** ingested
- [x] **Zero data loss** (auto-retry, conflict resolution)
- [x] **6x compression** (Parquet ZSTD)
- [x] **ACID transactions** (Iceberg)

## Completed

- [x] Real-time WebSocket ingestion
- [x] Kafka producer/consumer with error handling
- [x] Bronze layer with date partitioning
- [x] Docker orchestration with health checks
- [x] Environment-based config
- [x] Diagnostic monitoring script

## Next

- [ ] Add Redis
- [ ] Break monolith consumer into microservices
- [ ] Spark Structured Streaming
- [ ] Silver layer OHLCV (1m/5m/1h/4h/1d)
- [ ] Schema evolution
- [ ] REST API with /metrics
- [ ] Retention policies (Bronze 24h TTL)
- [ ] Unit tests