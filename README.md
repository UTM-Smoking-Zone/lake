# Trading Data Lakehouse

Real-time cryptocurrency trading data processing pipeline using modern lakehouse architecture. 
The system ingests live trading data from Bybit WebSocket API, processes it through Kafka streaming, and stores it in Apache Iceberg tables with Bronze/Silver/Gold data layers. 
Built with Apache Spark for stream processing, MinIO for S3-compatible object storage, and PostgreSQL as the Iceberg catalog. The entire infrastructure runs on Docker Compose for easy deployment and includes automatic WebSocket reconnection, data quality validation, and real-time OHLCV aggregations.
Access the system through Kafka UI (port 8090), Spark UI (port 8080), and MinIO Console (port 9001) for monitoring and management.

