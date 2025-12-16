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
- PostgreSQL 15 (microservices OLTP + Iceberg catalog)
- Redis 7 (caching + real-time prices)
- Kafka + Zookeeper (message streaming)
- MinIO S3 (Data Lake - Iceberg tables)
- PyIceberg (data lakehouse format)

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

### ✅ Implemented

**Authentication & User Management:**
- User registration (email + password, bcrypt hashing)
- Login with JWT tokens (24h expiry)
- Protected routes with middleware
- User profile management

**Trading (Backend Ready, Frontend Partial):**
- Portfolio creation and management
- Market, limit, stop, and stop-limit orders
- Order execution with balance verification
- Order cancellation with ownership check
- Transaction history tracking
- CSRF protection on all trading endpoints

**Market Data:**
- Real-time Binance WebSocket integration (10 symbols)
- Live price updates via Socket.IO
- Historical OHLCV data (1m, 5m, 15m, 1h intervals)
- Interactive trading charts (Lightweight Charts)

**Analytics:**
- Technical indicators: SMA (20/50/200), EMA, RSI, MACD
- Bollinger Bands, Volatility (10d/14d)
- ML features extraction (12 parameters)
- Redis caching (60s TTL)

**ML Predictions:**
- LSTM Keras model (enhanced_ultimate_sell_predictor_v2)
- SELL/HOLD signals with confidence scores
- 12-feature input (SMA, BB, MACD, volatility)
- Model metrics: F1=0.918, AUC=0.969
- Simple trend prediction (SMA-based fallback)
- Strategy backtesting (Sharpe ratio, drawdown, win rate)

**Infrastructure:**
- Circuit breaker pattern (resilience)
- Rate limiting (100 req/15min)
- Health checks on all services
- WebSocket authentication
- Database transactions with row-level locking

### ⚠️ Partially Implemented

**Frontend UI:**
- ✅ Dashboard with live prices (Binance API)
- ✅ Trading interface (UI only)
- ✅ Portfolio page (hardcoded data)
- ✅ Analytics page (hardcoded data)
- ✅ Settings page (UI only)
- ❌ Buy/Sell buttons not connected to backend
- ❌ Real portfolio data not fetched from API
- ❌ Chart interval switching not functional
- ❌ Settings save functionality missing

### ❌ Not Implemented

- Change password endpoint
- Two-factor authentication (2FA)
- Email notifications
- Push notifications
- Auto-trading
- Live order book
- Advanced charting tools
- Order history in frontend
- Watchlist management (backend missing)

## API Examples

### Authentication

#### Register
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "strongpassword123",
    "first_name": "John",
    "last_name": "Doe"
  }'
```

#### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "strongpassword123"
  }'
# Returns: {"token": "eyJhbGc...", "user": {...}}
```

#### Get CSRF Token
```bash
curl http://localhost:8000/api/csrf-token \
  -H "Cookie: _csrf=..." \
  --cookie-jar cookies.txt
# Returns: {"csrfToken": "..."}
```

### Portfolio Management

#### Get User Portfolio
```bash
curl http://localhost:8000/api/portfolio/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Create Portfolio
```bash
curl -X POST http://localhost:8001/portfolio \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "name": "Main Portfolio",
    "currency": "USDT"
  }'
```

### Trading

#### Create Order (requires CSRF)
```bash
curl -X POST http://localhost:8000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -H "Cookie: _csrf=..." \
  -d '{
    "symbol_id": 1,
    "portfolio_id": 1,
    "side": "buy",
    "type": "limit",
    "quantity": 0.01,
    "price": 45000.00
  }'
```

#### Execute Order (requires CSRF + ownership check)
```bash
curl -X POST http://localhost:8000/api/orders/123/execute \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -H "Cookie: _csrf=..."
```

#### Cancel Order (requires CSRF + ownership check)
```bash
curl -X PATCH http://localhost:8000/api/orders/123/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-CSRF-Token: YOUR_CSRF_TOKEN" \
  -H "Cookie: _csrf=..."
```

### Transaction History
```bash
curl http://localhost:8000/api/transactions/1?limit=50&offset=0 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Analytics

#### Technical Indicators
```bash
curl "http://localhost:8000/api/analytics/indicators/BTCUSDT?interval=1h" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Returns: SMA (20/50/200), EMA, RSI, MACD, Bollinger Bands
```

#### OHLCV Data
```bash
curl "http://localhost:8000/api/analytics/ohlcv/BTCUSDT?interval=1m&limit=100"
```

#### ML Features
```bash
curl "http://localhost:8000/api/analytics/ml-features/BTCUSDT?interval=1h"
# Returns: 12 features for ML model
```

### ML Predictions

#### Simple Trend Prediction
```bash
curl "http://localhost:8000/api/ml/predict?symbol=BTCUSDT&horizon=60"
```

#### Advanced LSTM Prediction
```bash
curl -X POST http://localhost:8000/api/ml/predict-advanced \
  -H "Content-Type: application/json" \
  -d '{
    "features": [[high, sma_20, sma_50, sma_200, bb_middle, bb_upper,
                  volatility_10d, volatility_14d, macd_12_26, macd_5_35,
                  macd_signal_5_35, below_all_sma], ...]
  }'
# Returns: {"prediction": "SELL", "confidence": 0.89, ...}
```

#### Backtest Strategy
```bash
curl -X POST http://localhost:8000/api/ml/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "strategy": "sma_crossover",
    "params": {"fast": 20, "slow": 50}
  }'
# Returns: Sharpe ratio, max drawdown, win rate, total return
```

#### Model Info
```bash
curl http://localhost:8000/api/ml/model-info
```

### Market Data (NestJS Service)

#### Get Candles
```bash
curl "http://localhost:3001/candles?symbol=BTCUSDT&interval=1m&limit=100"
```

#### WebSocket (Socket.IO)
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3001/market');

socket.on('kline', (data) => {
  console.log('New candle:', data);
  // { time, open, high, low, close, isFinal, interval, symbol }
});
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
