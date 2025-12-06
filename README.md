# 🌊 Lake - Real-time Cryptocurrency Trading Platform

A modern, real-time cryptocurrency trading platform built with a lakehouse architecture, featuring live market data streaming from Binance and advanced data processing capabilities.

**University Project | Team: Nick, Dan, Damian, Valentina | UTM 2025**

## 🏗️ Architecture

```
┌─────────────────┐
│   Binance API   │ (WebSocket + REST)
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Market Data Service (NestJS + Socket.IO)   │
│  - Real-time Binance WebSocket stream       │
│  - Historical candlestick data (REST API)   │
│  - Socket.IO broadcasting to clients        │
└─────────┬───────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────┐
│  Frontend (Next.js 16 + React 19)           │
│  - Lightweight-charts visualization         │
│  - Real-time Socket.IO updates              │
│  - Responsive candlestick charts            │
└─────────────────────────────────────────────┘

Data Pipeline (Parallel):
┌──────────┐   ┌────────┐   ┌──────────────┐   ┌────────────┐
│ Producer │──▶│ Kafka  │──▶│   Consumer   │──▶│ Iceberg DB │
└──────────┘   └────────┘   │  + Redis     │   └────────────┘
                             └──────────────┘
```

## 🚀 Features

### Real-time Market Data
- **Live Binance WebSocket Stream** - Direct connection to Binance for BTC/USDT 1m candlesticks
- **Socket.IO Broadcasting** - Real-time price updates to all connected clients
- **Historical Data API** - REST endpoint for loading candlestick history

### Data Processing
- **Apache Kafka** - High-throughput message streaming
- **Apache Iceberg** - Modern lakehouse table format
- **Apache Spark** - Distributed data processing
- **Redis** - Low-latency caching layer

### Frontend
- **Next.js 16** - Latest React framework with Turbopack
- **Lightweight-charts** - Professional candlestick charts
- **Socket.IO Client** - Real-time bidirectional communication
- **Tailwind CSS** - Modern, responsive styling

### Infrastructure
- **Docker Compose** - Complete containerized environment
- **PostgreSQL** - Metadata catalog for Iceberg
- **MinIO** - S3-compatible object storage
- **Kafka UI** - Web interface for monitoring Kafka

## 📋 Prerequisites

- Docker & Docker Compose
- 10GB+ free disk space
- Network access to Binance API (api.binance.com)

## 🔧 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/UTM-Smoking-Zone/lake.git
cd lake
```

### 2. Create Environment File
```bash
cp .env.example .env
```

Edit `.env` with your configuration (defaults work for local development).

### 3. Start the Platform
```bash
docker compose up -d
```

This will start:
- ✅ Market Data Service (port 3001)
- ✅ Frontend (port 3000)
- ✅ Kafka (port 9093)
- ✅ Redis (port 6380)
- ✅ PostgreSQL (port 5433)
- ✅ MinIO (ports 9010, 9011)
- ✅ Spark Master & Worker
- ✅ Kafka UI (port 8090)

### 4. Access the Application

**Frontend (Main Application):**
```
http://localhost:3000
```

**Kafka UI:**
```
http://localhost:8090
```

**MinIO Console:**
```
http://localhost:9011
Username: minioadmin
Password: minioadmin
```

**Spark UI:**
```
http://localhost:8080
```

## 🧪 Testing

### Run All Tests
```bash
# Backend health check
curl http://localhost:3001/candles?limit=1

# Check if Binance stream is connected
docker compose logs market-data-service | grep "Connected to Binance"

# View real-time updates
docker compose logs market-data-service --follow
```

### Test Socket.IO Connection
The frontend automatically connects to Socket.IO when you open http://localhost:3000

To check browser console:
1. Open http://localhost:3000
2. Press F12 (Developer Tools)
3. Go to Console tab
4. You should see connection logs

## 📊 API Documentation

### REST API

#### GET /candles
Retrieve historical candlestick data from Binance.

**Parameters:**
- `symbol` (optional): Trading pair (default: BTCUSDT)
- `interval` (optional): Timeframe (default: 1m)
  - Valid values: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
- `limit` (optional): Number of candles (default: 500, max: 1000)

**Example:**
```bash
curl "http://localhost:3001/candles?symbol=BTCUSDT&interval=1m&limit=100"
```

**Response:**
```json
[
  {
    "time": 1765009200,
    "open": 89553.81,
    "high": 89553.82,
    "low": 89513.63,
    "close": 89513.64
  }
]
```

### WebSocket API (Socket.IO)

**Endpoint:** `ws://localhost:3001/market`

**Events:**

#### Client → Server
- `connect` - Automatically handled by Socket.IO

#### Server → Client
- `connected` - Server confirmation message
- `kline` - Real-time candlestick update

**Kline Event Format:**
```json
{
  "symbol": "BTCUSDT",
  "interval": "1m",
  "time": 1765009500,
  "open": 89406.05,
  "high": 89437.3,
  "low": 89384.55,
  "close": 89384.56,
  "isFinal": false
}
```

## 🛠️ Development

### Project Structure
```
lake/
├── docker-compose.yml          # Orchestration config
├── kafka/
│   ├── kafka-producer/         # Mock data generator
│   └── kafka-consumer/         # Kafka → Iceberg + Redis
├── platform/
│   ├── back/                   # NestJS backend
│   │   ├── src/
│   │   │   ├── candles/        # Historical data module
│   │   │   └── market/         # WebSocket gateway
│   │   └── Dockerfile
│   └── front/                  # Next.js frontend
│       ├── src/
│       │   ├── app/            # Next.js pages
│       │   └── components/     # React components
│       └── Dockerfile
├── scripts/                    # Initialization scripts
└── data/                      # Persistent data (gitignored)
```

### Backend Development

**Tech Stack:** NestJS + TypeScript + Socket.IO + Axios

```bash
cd platform/back
npm install
npm run start:dev
```

**Key Files:**
- `src/main.ts` - Application entry point
- `src/market/market.gateway.ts` - WebSocket gateway for Binance stream
- `src/candles/candles.service.ts` - Historical data fetching

### Frontend Development

**Tech Stack:** Next.js 16 + React 19 + TypeScript + Lightweight-charts

```bash
cd platform/front
npm install
npm run dev
```

**Key Files:**
- `src/app/page.tsx` - Main page
- `src/components/BtcCandles.tsx` - Chart component

## 🔍 Troubleshooting

### Frontend shows blank chart
1. Check browser console (F12) for errors
2. Verify backend is running: `curl http://localhost:3001/candles?limit=1`
3. Check Socket.IO connection: `docker compose logs market-data-service`

### Binance connection failed
1. Check internet connection
2. Verify Binance API is accessible: `curl https://api.binance.com/api/v3/ping`
3. Check Docker logs: `docker compose logs market-data-service`

### Kafka consumer errors
1. Check Kafka is healthy: `docker compose ps kafka`
2. Verify topics exist: Open http://localhost:8090
3. Check consumer logs: `docker compose logs kafka-consumer`

### Disk space issues
```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a --volumes

# Clean up data directories
sudo rm -rf data/minio/warehouse/*
```

## 📝 Environment Variables

Key environment variables (see `.env`):

```bash
# PostgreSQL
POSTGRES_DB=trading
POSTGRES_USER=trading_user
POSTGRES_PASSWORD=trading_pass

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# Binance (optional - uses defaults)
BINANCE_WS=wss://stream.binance.com:9443/ws
BINANCE_REST=https://api.binance.com
DEFAULT_SYMBOL=BTCUSDT
DEFAULT_INTERVAL=1m
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📜 License

This project is part of the UTM Smoking Zone initiative.

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Frontend powered by [Next.js](https://nextjs.org/)
- Charts by [TradingView Lightweight Charts](https://www.tradingview.com/lightweight-charts/)
- Data from [Binance API](https://binance-docs.github.io/apidocs/)
- Lakehouse architecture with [Apache Iceberg](https://iceberg.apache.org/)

---

**Current Version:** 2.0.0 (NestJS Rewrite)
**Last Updated:** December 2025

🤖 Generated with [Claude Code](https://claude.com/claude-code)
