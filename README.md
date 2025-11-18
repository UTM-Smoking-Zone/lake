# Trading Analytics Platform

Microservices-based real-time crypto trading platform with analytics and ML predictions.

University Project | Team: Nick, Dan, Damian, Valentina | UTM 2025

## Architecture

**Microservices:**
- API Gateway (FastAPI + WebSocket) - :8000
- Portfolio Service - :8001
- Order Service - :8002
- Transaction Service - :8003
- Analytics Service - :8004
- ML Service - :8005
- User Service - :8006
- Ingestion Service (Kafka to Iceberg)

**Data Pipeline:**
- WebSocket to Kafka to Iceberg to MinIO S3
- Real-time crypto price ingestion

**Infrastructure:**
- PostgreSQL (microservices database)
- Redis (caching and real-time prices)
- Kafka (message streaming)
- MinIO (S3 storage)
- Apache Spark (data processing)

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start all services
./quickstart.sh

# 3. Test APIs
./test-api.sh
```

### Access Services

- API Gateway: http://localhost:8000
- Swagger UI: http://localhost:8000/docs
- Kafka UI: http://localhost:8090
- MinIO Console: http://localhost:9011
- Spark Master: http://localhost:8080

### Stop services

```bash
docker compose down
```

## Tech Stack

**Backend:** FastAPI, WebSocket, PostgreSQL, Redis  
**Data Pipeline:** Apache Kafka, Apache Iceberg, Apache Spark, MinIO  
**Deployment:** Docker Compose, Kubernetes

## Features

- Market and limit orders
- Portfolio management
- Transaction history
- Real-time price feed
- OHLCV data (1m, 5m, 1h, 4h, 1d)
- Technical indicators (SMA, EMA, RSI, MACD)
- ML price predictions
- Strategy backtesting

## API Examples
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

## Deployment

### Docker Compose

```bash
docker compose up -d
```

### Kubernetes

```bash
kubectl apply -f k8s/
```

## License

MIT License