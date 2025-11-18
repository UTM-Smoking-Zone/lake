# 🚀 Quick Start Guide for Team

## First Time Setup

```bash
# 1. Clone repository
git clone https://github.com/UTM-Smoking-Zone/lake.git
cd lake

# 2. Copy environment variables
cp .env.example .env
# Edit .env if needed (optional for local dev)

# 3. Start everything
./start.sh
# OR quick start (stops conflicting containers first):
./quickstart.sh

# 4. Test APIs
./test-api.sh
```

## Verify Setup

```bash
# Check all containers running
docker ps

# Check services health
curl http://localhost:8000/health

# View logs
docker compose logs -f api-gateway
```

## URLs

- **API Gateway**: http://localhost:8000
- **Portfolio Service**: http://localhost:8001
- **Order Service**: http://localhost:8002
- **Transaction Service**: http://localhost:8003
- **Analytics Service**: http://localhost:8004
- **ML Service**: http://localhost:8005
- **User Service**: http://localhost:8006
- **MinIO Console**: http://localhost:9011 (minioadmin/minioadmin123)
- **Kafka UI**: http://localhost:8090
- **PostgreSQL**: localhost:5433 (admin/admin123)

## Common Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f <service-name>

# Database access
docker compose exec postgres psql -U admin -d trading_db

# Redis access
docker compose exec redis redis-cli

# Clean restart
docker compose down -v
docker compose up -d --build
```

## Development Workflow

### For Backend (Dan, Nick)
```bash
# Work on a microservice
cd platform/back/portfolio-service/
# Edit main.py
# Rebuild just this service:
docker compose up -d --build portfolio-service
```

### For Frontend (Damian)
```bash
cd platform/front/
# Your React/Vue app here
```

### For ML (Valentina)
```bash
cd platform/back/ml-service/
# Improve models in main.py
docker compose up -d --build ml-service
```

## Testing

```bash
# Full API test
./test-api.sh

# Manual endpoint test
curl http://localhost:8000/api/prices/BTCUSDT

# Check database
docker compose exec postgres psql -U admin -d trading_db -c "SELECT * FROM users;"
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.

**Quick fixes**:
```bash
# Port conflicts
./quickstart.sh  # Stops conflicting containers

# Services not starting
docker compose down
docker compose up -d

# Database issues
docker compose down -v  # WARNING: Deletes data!
docker compose up -d
```

## Git Workflow

```bash
# Before starting work
git pull origin main

# Create feature branch
git checkout -b feature/your-feature

# Commit changes
git add .
git commit -m "feat: description"

# Push and create PR
git push origin feature/your-feature
```

## Need Help?

- 📚 [Full Documentation](README.md)
- 🏗️ [Architecture](ARCHITECTURE.md)
- 🐛 [Troubleshooting](TROUBLESHOOTING.md)
- 🤝 [Contributing](CONTRIBUTING.md)

---

**Team**: Nick, Dan, Damian, Valentina | **Project**: Trading Analytics Platform
