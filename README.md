# 📈 Trading Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5.svg)](https://kubernetes.io/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688.svg)](https://fastapi.tiangolo.com/)

**Microservices-based** real-time crypto trading platform with analytics and ML predictions.

> 🎓 **University Project** | Team: Nick, Dan, Damian, Valentina | UTM 2025

## 🏗️ Architecture

**Microservices:**
- 🌐 API Gateway (FastAPI + WebSocket) - `:8000`
- 📊 Portfolio Service - `:8001`
- 💼 Order Service - `:8002`
- 📝 Transaction Service - `:8003`
- 📈 Analytics Service - `:8004`
- 🤖 ML Service - `:8005`
- 👤 User Service - `:8006`
- 🔄 Ingestion Service (Kafka → Iceberg)

**Data Pipeline:**
- WebSocket → Kafka → Iceberg → MinIO S3
- Real-time crypto price ingestion

**Infrastructure:**
- PostgreSQL (microservices database)
- Redis (caching + real-time prices)
- Kafka (message streaming)
- MinIO (S3 storage)
- Apache Spark (data processing)

## 🚀 Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start all services
./quickstart.sh

# 3. Test APIs
./test-api.sh
```

### Access Services
```bash
./test-api.sh
```

### Service URLs
- **API Gateway**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **Kafka UI**: http://localhost:8082
- **MinIO Console**: http://localhost:9011 (admin/minioadmin)
- **Spark Master**: http://localhost:8080

### Stop all services
```bash
docker compose down
```

## 📚 Documentation

- **[MICROSERVICES.md](MICROSERVICES.md)** - Quick start guide
- **[platform/back/README.md](platform/back/README.md)** - Architecture details
- **[TODO.md](TODO.md)** - Project tasks

## Stack

- **Ingestion**: Bybit WebSocket → Kafka (3 partitions)
- **Storage**: Iceberg tables (Parquet + ZSTD) on MinIO S3
- **Catalog**: PostgreSQL metadata
- **Backend**: FastAPI microservices
- **Cache**: Redis
- **Processing**: Apache Spark
- **Monitoring**: Kafka UI :8090, MinIO Console :9001

## Status

- [x] **Microservices architecture** (8 services)
- [x] **API Gateway** with WebSocket
- [x] **PostgreSQL schema** for trading
- [x] **2M+ records** ingested
- [x] **Zero data loss** (auto-retry, conflict resolution)
- [x] **6x compression** (Parquet ZSTD)
- [x] **ACID transactions** (Iceberg)

## Features

### Trading
- ✅ Demo wallets ($10,000 virtual balance)
- ✅ Market & limit orders
- ✅ Portfolio management
- ✅ Transaction history
- ✅ Real-time price feed

### Analytics
- ✅ OHLCV data (1m, 5m, 1h, 4h, 1d)
- ✅ Technical indicators (SMA, EMA, RSI, MACD)
- ✅ Real-time calculations

### ML
- ✅ Price predictions
- ✅ Strategy backtesting
- ✅ SMA crossover, RSI strategies

## API Examples

### Create user & demo wallet
```bash
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username": "trader1", "email": "trader1@example.com"}'

curl -X POST http://localhost:8000/api/users/1/demo-wallet \
  -H "Content-Type: application/json" \
  -d '{"initial_balance": 10000}'
```

### Place order
```bash
curl -X POST http://localhost:8000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "portfolio_id": 1,
    "symbol": "BTCUSDT",
    "side": "buy",
    "type": "market",
    "quantity": 0.01
  }'
```

### Get analytics
```bash
curl "http://localhost:8000/api/analytics/ohlcv?symbol=BTCUSDT&interval=1m"
curl "http://localhost:8000/api/analytics/indicators?symbol=BTCUSDT&indicators=sma,ema,rsi"
```

### ML prediction
```bash
curl "http://localhost:8000/api/ml/predict?symbol=BTCUSDT&horizon=60"
```

## 🚀 Deployment

### Docker Compose (Development)
```bash
docker-compose up -d
```

### Kubernetes (Production)
```bash
# Minikube (Local)
make setup-minikube

# Production cluster
kubectl apply -f k8s/
```

**See [KUBERNETES.md](KUBERNETES.md) for detailed deployment guide**

### Features:
- ✅ Kubernetes manifests (Deployments, Services, StatefulSets)
- ✅ Horizontal Pod Autoscaling (HPA)
- ✅ Ingress Controller (NGINX)
- ✅ Prometheus + Grafana monitoring
- ✅ GitHub Actions CI/CD pipeline
- ✅ Makefile for easy management

## 📊 Monitoring

- **Prometheus**: Metrics collection
- **Grafana**: Dashboards & visualization
- **Exporters**: PostgreSQL, Redis, Kafka

Access after deployment:
```bash
make port-forward-grafana  # localhost:3000
```

## Next

- [ ] Frontend (React/Vue dashboard)
- [ ] WebSocket real-time updates
- [ ] Authentication (JWT)
- [ ] Spark Structured Streaming
- [ ] Silver layer OHLCV aggregations
- [ ] Service Mesh (Istio)
- [ ] Distributed tracing (Jaeger)
- [ ] Unit tests