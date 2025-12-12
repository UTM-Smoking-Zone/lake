# TODO - Crypto Trading Lakehouse Platform

**University Project | Team: Nick, Dan, Damian, Valentina | UTM 2025**

---

## ✅ COMPLETED

### 🎯 **MICROSERVICES ARCHITECTURE** (Dec 11, 2025)
- [x] **Database per Service Pattern** - 5 isolated PostgreSQL databases
  - [x] postgres-user `:5434` (user_service)
  - [x] postgres-portfolio `:5435` (portfolio_service)
  - [x] postgres-orders `:5436` (order_service)
  - [x] postgres-transactions `:5437` (transaction_service)
  - [x] postgres-analytics `:5438` (analytics_service)
- [x] **Event-Driven Communication** - Kafka topics for inter-service events
  - [x] user-events, portfolio-events, order-events, transaction-events
- [x] **Removed Distributed Monolith** - No more shared database coupling
- [x] ~~Market Data Service~~ **REMOVED** (duplication eliminated)
- [x] **Kafka Event Library** - Shared library for event publishing

### Infrastructure (22 containers - was 17)
- [x] Docker Compose orchestration
- [x] Apache Kafka + Zookeeper (message streaming)
- [x] 5 PostgreSQL 15 databases (Database per Service)
- [x] Redis 7 (caching + real-time prices)
- [x] MinIO S3 (Data Lake storage)
- [x] ~~Apache Spark~~ **REMOVED** (not needed, using PyIceberg)

### Microservices (6 services - was 8)
- [x] API Gateway (Express + WebSocket) `:8000` - No direct DB access
- [x] User Service (auth, users) `:8006` → postgres-user
- [x] Portfolio Service `:8001` → postgres-portfolio
- [x] Order Service `:8002` → postgres-orders
- [x] Transaction Service `:8003` → postgres-transactions
- [x] Analytics Service (OHLCV, indicators) `:8004` → postgres-analytics
- [x] ML Service (predictions) `:8005` - Stateless

### Data Pipeline
- [x] Kafka Producer (Binance WebSocket → Kafka)
- [x] **Kafka Consumer** (3.01M+ messages processed)
  - [x] Writes to **postgres-analytics** (was monolithic postgres)
  - [x] Writes to Iceberg (MinIO S3, long-term storage)
  - [x] Updates Redis (live prices)
- [x] PostgreSQL OHLCV tables (1m, 5m, 15m, 1h materialized views)
- [x] 118 real-time candles in last 2 hours

### Database (Microservices Pattern)
- [x] **5 isolated databases** - Database per Service
- [x] User Service DB: users, user_events
- [x] Portfolio Service DB: portfolios, balances, assets
- [x] Order Service DB: orders, order_events
- [x] Transaction Service DB: transactions (partitioned by month)
- [x] Analytics Service DB: ohlcv_1m + materialized views
- [x] Removed FK constraints between services

### Frontend
- [x] Next.js 16 Frontend `:3000`
- [x] BTC Trading Dashboard with candlestick charts
- [x] Real-time WebSocket integration

### Security & Quality (FIXED Dec 11, 2025)
- [x] **Bcrypt password hashing** (was CRITICAL vulnerability)
- [x] Health endpoints for all services
- [x] CORS configured

### Documentation
- [x] README.md (project overview)
- [x] **Architecture diagram** (PlantUML + PNG) - Updated for microservices
- [x] **MICROSERVICES_MIGRATION.md** - Full migration guide
- [x] **MICROSERVICES_SUMMARY.md** - Quick reference
- [x] **DEPLOY.md** - Step-by-step deployment instructions
- [x] Docker setup
- [x] Environment configuration

---

## 🔴 CRITICAL ISSUES (MUST FIX IMMEDIATELY)

### 1. ~~Passwords in Plain Text~~ ✅ FIXED (Dec 11, 2025)
- ✅ Bcrypt implemented with salt rounds: 12
- ✅ All new users use hashed passwords
- ⚠️ **Old users with plain text passwords cannot login** (need migration or deletion)

### 2. Missing package-lock.json 🔴 URGENT
- [ ] **0/7 microservices** have package-lock.json
- [ ] Generate lock files for reproducible builds
- **Risk**: Unstable dependency versions, "works on my machine" issues
- **Effort**: 10 minutes

### 3. CORS Open to All 🔴 SECURITY
- [ ] Current: `origin: '*'` (any site can call API)
- [ ] Change to: `origin: process.env.FRONTEND_URL`
- **Risk**: XSS attacks, CSRF, unauthorized access
- **Effort**: 5 minutes

---

## ⚠️ HIGH PRIORITY ISSUES

### 4. No Security Middleware 🟡
- [ ] Add **Helmet** (security headers)
- [ ] Add **Rate Limiting** (DDoS/brute-force protection)
- [ ] Add **Input Validation** (joi/zod)
- [ ] Add **JWT Authentication** middleware
- **Effort**: 1-2 hours

### 5. No Docker Healthchecks 🟡
- [ ] Add healthcheck for 8 Node.js services in docker-compose.yml
- ✅ Already have: PostgreSQL, Redis, Kafka, MinIO
- **Risk**: Docker doesn't know if service is healthy
- **Effort**: 30 minutes

### 6. Poor Logging 🟡
- [ ] Replace `console.log` with **Winston** or **Pino**
- [ ] Add structured logging (JSON format)
- [ ] Add log levels (info, warn, error)
- [ ] Centralized logging (optional: ELK stack)
- **Effort**: 2 hours

### 7. Cleanup Unused Files 🟡
- [ ] Delete `.venv` directory (428MB - unused Python venv)
- [ ] Delete `node_modules` in root (7.7MB - test dependencies)
- **Total cleanup**: 436MB
- **Effort**: 2 minutes

---

## 🎯 FEATURE IMPROVEMENTS

### Analytics Service
- [ ] Connect to Iceberg Silver layer (currently uses PostgreSQL only)
- [ ] More indicators: Bollinger Bands, Stochastic, ATR
- [ ] Custom indicator builder
- [ ] Alert system (price crosses SMA, RSI overbought/oversold)

### ML Service
- [ ] Real ML model (LSTM/Transformer for price prediction)
- [ ] Model training pipeline
- [ ] Model versioning
- [ ] Feature engineering (volume, momentum, sentiment)

### API Gateway
- [ ] JWT authentication
- [ ] Rate limiting (express-rate-limit)
- [ ] API versioning (/v1, /v2)
- [ ] Request logging with correlation IDs
- [ ] Redis caching for OHLCV queries

### Frontend
- [ ] User authentication UI (login/register)
- [ ] Real-time price updates (WebSocket)
- [ ] Trading interface (buy/sell orders)
- [ ] Portfolio overview with PnL
- [ ] Order history table
- [ ] Technical indicators visualization

### Order Service
- [ ] Limit order matching engine
- [ ] Stop-loss / take-profit orders
- [ ] Order book management
- [ ] Real-time order status updates (WebSocket)

### Portfolio Service
- [ ] Real-time PnL calculations
- [ ] Multiple asset support (ETH, SOL, etc.)
- [ ] Portfolio performance metrics (Sharpe ratio, max drawdown)
- [ ] Historical snapshots

---

## 🧪 TESTING & QUALITY

### Testing
- [ ] Unit tests for each microservice (currently: 7 test files)
- [ ] Integration tests
- [ ] Load testing (Locust/JMeter)
- [ ] E2E tests
- **Current coverage**: Minimal

### CI/CD
- [ ] GitHub Actions workflow
- [ ] Automated testing on PR
- [ ] Docker image building
- [ ] Deployment automation
- **Current**: None

---

## 📊 MONITORING & OBSERVABILITY

### Monitoring
- [ ] Prometheus metrics
- [ ] Grafana dashboards
- [ ] Alert manager
- ✅ Kafka UI (already running on :8090)

### Metrics to Track
- [ ] Kafka consumer lag
- [ ] API response times
- [ ] Database query performance
- [ ] Error rates
- [ ] WebSocket connections

---

## 📝 DOCUMENTATION IMPROVEMENTS

### Missing Documentation
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Deployment guide
- [ ] User manual
- [ ] Architecture Decision Records (ADRs)
- [ ] Contributing guide
- [x] ~~README with Spark~~ (Updated - Spark removed)

### Updates Needed
- [ ] Update README.md (remove Spark mention)
- [ ] Add bcrypt security info
- [ ] Document real-time data pipeline

---

## 🎁 BONUS FEATURES (If Time Permits)

- [ ] Multi-exchange support (Binance, Kraken, Coinbase)
- [ ] Telegram bot for price alerts
- [ ] Mobile app (React Native)
- [ ] Social trading (copy other users)
- [ ] Leaderboard
- [ ] Paper trading competitions
- [ ] Educational content (tutorials, trading strategies)

---

## 📅 RECOMMENDED TIMELINE

### Phase 1: Critical Security (This Week) 🔴
**Time: 2 hours**
1. ✅ ~~Bcrypt password hashing~~ (DONE)
2. Generate package-lock.json (10 min)
3. Fix CORS to specific origin (5 min)
4. Add Helmet + Rate Limiting (30 min)
5. Docker healthchecks (30 min)
6. Delete .venv and node_modules (2 min)

### Phase 2: Quality & Stability (Week 2) 🟡
**Time: 4-6 hours**
1. Winston/Pino logging (2h)
2. Input validation (1h)
3. JWT authentication (2h)
4. Unit tests (1-2h)

### Phase 3: Features (Week 3-4) 🟢
**Time: 8-12 hours**
1. Frontend improvements (4h)
2. Advanced indicators (2h)
3. Order matching engine (3h)
4. ML model training (3h)

### Phase 4: DevOps & Monitoring (Week 5) 🟢
**Time: 4-6 hours**
1. Prometheus + Grafana (2h)
2. GitHub Actions CI/CD (2h)
3. Documentation (2h)

---

## 🚨 CURRENT STATUS

**Last Updated**: December 11, 2025

### System Health
- ✅ **17/17 containers running** (32+ hours uptime)
- ✅ **Kafka Consumer**: 2.45M+ messages processed, 0 errors
- ✅ **Real-time data**: 59 candles in last hour
- ✅ **All health endpoints**: Working
- ✅ **Security**: Bcrypt implemented

### Critical Issues Remaining
- 🔴 **package-lock.json**: Missing (0/7 services)
- 🔴 **CORS**: Open to all (`origin: '*'`)
- 🟡 **Security middleware**: None (no helmet, no rate limiting)
- 🟡 **Docker healthchecks**: Missing for Node.js services
- 🟡 **Logging**: Basic console.log only

### Database Stats
- Users: 6 (1 old plain text, 5+ with bcrypt)
- Orders: 4
- OHLCV data: ~860KB (real-time growing)
- PostgreSQL: Healthy

---

## 📞 CONTACTS & RESOURCES

**Team Members**:
- Nick (Core Pipeline & Infrastructure)
- Dan (Backend Services & Database)
- Damian (Frontend & API Gateway)
- Valentina (Analytics & ML)

**Quick Links**:
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000/health
- Kafka UI: http://localhost:8090
- PostgreSQL: localhost:5433
- Redis: localhost:6380
- MinIO: http://localhost:9010 (admin:admin123)

**Project Repository**: UTM 2025 Trading Platform

---

## 🏁 NEXT STEPS (In Priority Order)

1. ✅ ~~Fix bcrypt password hashing~~ **DONE**
2. 🔴 Generate package-lock.json for all services (10 min)
3. 🔴 Fix CORS to specific origin (5 min)
4. 🟡 Add Helmet + Rate Limiting (30 min)
5. 🟡 Add Docker healthchecks (30 min)
6. 🟡 Delete .venv and node_modules (2 min)
7. 🟡 Implement Winston logging (2 hours)
8. 🟢 Start Phase 3 features

**Blockers**: None

**Demo Ready**: Frontend + Backend working, need security improvements before production.
