# Trading Analytics Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933.svg)](https://nodejs.org/)

Microservices-based real-time crypto trading platform with analytics and ML predictions.

University Project | Team: Nick, Dan, Damian, Valentina | UTM 2025

## Architecture

**Microservices:**
- API Gateway (Node.js + WebSocket) - :8000
- Portfolio Service - :8001
- Order Service - :8002
- Transaction Service - :8003
- Analytics Service - :8004
- ML Service - :8005
- User Service - :8006
- Market Data Service (NestJS + Binance) - :3001

**Data Pipeline:**
- Binance WebSocket → Kafka → Iceberg → MinIO S3
- Real-time crypto price ingestion

**Infrastructure:**
- PostgreSQL (microservices database)
- Redis (caching + real-time prices)
- Kafka (message streaming)
- MinIO (S3 storage)
- Apache Spark (data processing)

## Quick Start

```bash
# Copy environment file
cp .env.example .env

# Start all services
docker compose up -d

# Check service health
curl http://localhost:8000/health
```

### Access Services

- **API Gateway**: http://localhost:8000
- **Market Data**: http://localhost:3001
- **Frontend**: http://localhost:3000
- **Kafka UI**: http://localhost:8090
- **MinIO Console**: http://localhost:9011 (minioadmin/minioadmin)
- **Spark Master**: http://localhost:8080

### Stop all services
```bash
docker compose down
```

## Stack

- **Ingestion**: Binance WebSocket → Kafka (3 partitions)
- **Storage**: Iceberg tables (Parquet + ZSTD) on MinIO S3
- **Catalog**: PostgreSQL metadata
- **Backend**: Node.js microservices + NestJS
- **Cache**: Redis
- **Processing**: Apache Spark
- **Monitoring**: Kafka UI :8090, MinIO Console :9011

## Status

- Microservices architecture (8 services)
- API Gateway with WebSocket
- PostgreSQL schema for trading
- Real-time Binance data stream
- Zero data loss (auto-retry, conflict resolution)
- 6x compression (Parquet ZSTD)
- ACID transactions (Iceberg)

## Features

### Trading
- Demo wallets ($10,000 virtual balance)
- Market & limit orders
- Portfolio management
- Transaction history
- Real-time price feed from Binance

### Analytics
- OHLCV data (1m, 5m, 1h, 4h, 1d)
- Technical indicators (SMA, EMA, RSI, MACD)
- Real-time calculations

### ML
- Price predictions
- Strategy backtesting
- SMA crossover, RSI strategies

## API Examples

### Portfolio
```bash
curl http://localhost:8000/api/portfolio/user123
```

### Create Order
```bash
curl -X POST http://localhost:8000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user123","symbol":"BTCUSDT","type":"market","side":"buy","amount":0.01}'
```

### Get Transactions
```bash
curl http://localhost:8000/api/transactions/user123
```

### Technical Indicators
```bash
curl "http://localhost:8000/api/analytics/indicators?symbol=BTCUSDT&indicators=sma,rsi"
```

### ML Prediction
```bash
curl "http://localhost:8000/api/ml/predict?symbol=BTCUSDT&horizon=60"
```

### Market Data (Binance)
```bash
curl "http://localhost:3001/candles?symbol=BTCUSDT&interval=1m&limit=100"
```

## Testing

```bash
# Test all services
cd platform/services/api-gateway && npm test
cd platform/services/portfolio-service && npm test
cd platform/services/order-service && npm test
cd platform/services/transaction-service && npm test
cd platform/services/analytics-service && npm test
cd platform/services/ml-service && npm test
cd platform/services/user-service && npm test

# Test market data service
cd platform/back && npm test
```

## Development

### Project Structure
```
lake/
├── docker-compose.yml
├── kafka/
│   ├── kafka-producer/
│   └── kafka-consumer/
├── platform/
│   ├── services/
│   │   ├── api-gateway/
│   │   ├── portfolio-service/
│   │   ├── order-service/
│   │   ├── transaction-service/
│   │   ├── analytics-service/
│   │   ├── ml-service/
│   │   └── user-service/
│   ├── back/                  # NestJS market data
│   └── front/                 # Next.js frontend
└── scripts/
```

### Local Development

```bash
# Start infrastructure only
docker compose up -d postgres redis kafka minio

# Run service locally
cd platform/services/api-gateway
npm install
npm run dev
```

## Monitoring

- **Kafka UI**: http://localhost:8090
- **MinIO Console**: http://localhost:9011
- **Spark UI**: http://localhost:8080

## License

MIT License - University Project UTM 2025
