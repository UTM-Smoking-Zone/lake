# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Microservices architecture with 8 independent services
- API Gateway with WebSocket support
- Portfolio, Order, Transaction, User services
- Analytics service with technical indicators (SMA, EMA, RSI)
- ML service with price prediction and backtesting
- Ingestion service (Kafka → Iceberg pipeline)
- Real-time data pipeline (WebSocket → Kafka → MinIO/Iceberg)
- PostgreSQL database with complete schema
- Redis caching layer
- Kubernetes manifests for production deployment
- Horizontal Pod Autoscaler (HPA) configuration
- Prometheus + Grafana monitoring stack
- CI/CD pipeline with GitHub Actions
- Docker Compose orchestration
- Comprehensive documentation (14 MD files)
- Makefile for common operations
- Health checks for all services
- Automated startup scripts (start.sh, quickstart.sh)
- API testing script (test-api.sh)

### Infrastructure
- Apache Kafka for message streaming
- Apache Spark for data processing
- MinIO for S3-compatible object storage
- Apache Iceberg for data lakehouse (Bronze/Silver/Gold layers)
- PostgreSQL 15 for relational data
- Redis 7 for caching and real-time data
- Zookeeper for Kafka coordination

### Documentation
- Architecture documentation
- Deployment guide
- Kubernetes operations guide
- Microservices overview
- Tech stack details
- Troubleshooting guide
- Project audit report
- Presentation materials

## [0.1.0] - 2025-11-18

### Added
- Initial project structure
- Basic Kafka producer/consumer
- MinIO storage setup
- PostgreSQL database initialization
- Basic Docker Compose configuration

---

## Release Notes Format

### Added
- New features

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security fixes
