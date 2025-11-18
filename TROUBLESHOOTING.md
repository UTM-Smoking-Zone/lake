# 🔧 Troubleshooting Guide

## Quick Diagnostics

### Check if services are running
```bash
docker compose ps
```

### Check specific service logs
```bash
docker compose logs -f api-gateway
docker compose logs -f portfolio-service
docker compose logs -f order-service
```

### Check all service health endpoints
```bash
curl http://localhost:8000/health  # API Gateway
curl http://localhost:8001/health  # Portfolio Service
curl http://localhost:8002/health  # Order Service
curl http://localhost:8003/health  # Transaction Service
curl http://localhost:8004/health  # Analytics Service
curl http://localhost:8005/health  # ML Service
curl http://localhost:8006/health  # User Service
```

---

## Common Issues

### 1. Services not starting

**Error**: `./test-api.sh` shows "API Gateway is not running"

**Solution**:
```bash
# Start all services
./start.sh

# OR manually
docker compose up -d --build

# Wait 30-60 seconds for initialization
sleep 30

# Test again
./test-api.sh
```

---

### 2. Port already in use

**Error**: `Bind for 0.0.0.0:8000 failed: port is already allocated`

**Find process using the port**:
```bash
sudo lsof -i :8000
```

**Kill the process**:
```bash
sudo kill -9 <PID>
```

**Or change port in docker-compose.yml**:
```yaml
api-gateway:
  ports:
    - "8001:8000"  # Map to different host port
```

---

### 3. Database connection errors

**Error**: `psycopg2.OperationalError: could not connect to server`

**Check PostgreSQL**:
```bash
docker compose logs postgres
```

**Recreate PostgreSQL**:
```bash
docker compose down postgres
docker compose up -d postgres
# Wait 10 seconds
docker compose up -d
```

**Reset database**:
```bash
docker compose down -v  # WARNING: Deletes all data!
docker compose up -d
```

---

### 4. Kafka connection errors

**Error**: `KafkaError: Broker transport failure`

**Check Kafka**:
```bash
docker compose logs kafka
docker compose logs zookeeper
```

**Restart Kafka stack**:
```bash
docker compose restart zookeeper
sleep 5
docker compose restart kafka
sleep 10
docker compose restart kafka-producer ingestion-service
```

---

### 5. MinIO permission errors

**Error**: `AccessDenied: Access Denied`

**Check MinIO**:
```bash
docker compose logs minio
```

**Recreate buckets**:
```bash
docker compose up -d minio-setup
docker compose logs minio-setup
```

---

### 6. Iceberg catalog errors

**Error**: `Catalog not found`

**Initialize Iceberg**:
```bash
docker compose up -d iceberg-init
docker compose logs iceberg-init
```

---

### 7. API returns 404 errors

**Error**: `"message": "Requested URL /api/users not found"`

**Causes**:
1. API Gateway not running
2. Wrong port
3. Service routing misconfigured

**Solutions**:
```bash
# Check if API Gateway is running
docker compose ps | grep api-gateway

# Check API Gateway logs
docker compose logs api-gateway

# Restart API Gateway
docker compose restart api-gateway

# Verify correct URL
curl http://localhost:8000/docs  # Should show Swagger UI
```

---

### 8. Redis connection errors

**Error**: `redis.exceptions.ConnectionError`

**Check Redis**:
```bash
docker compose logs redis

# Test Redis connection
docker compose exec redis redis-cli ping
# Should return: PONG
```

**Restart Redis**:
```bash
docker compose restart redis
```

---

### 9. Spark job failures

**Error**: Spark Structured Streaming not working

**Check Spark**:
```bash
docker compose logs spark-master
docker compose logs spark-worker

# Access Spark UI
open http://localhost:8080
```

**Restart Spark**:
```bash
docker compose restart spark-master spark-worker
```

---

### 10. Out of disk space

**Error**: `no space left on device`

**Check Docker disk usage**:
```bash
docker system df
```

**Clean up**:
```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove unused containers
docker container prune

# Remove everything (careful!)
docker system prune -a --volumes
```

---

## Service-Specific Issues

### API Gateway (Port 8000)

**Problem**: WebSocket not connecting

**Solution**:
```bash
# Check WebSocket endpoint
wscat -c ws://localhost:8000/ws

# Check API Gateway logs
docker compose logs -f api-gateway | grep WebSocket
```

---

### Portfolio Service (Port 8001)

**Problem**: Cannot create portfolio

**Solution**:
```bash
# Check database schema
docker compose exec postgres psql -U admin -d trading_db -c "\dt"

# Check if users table exists
docker compose exec postgres psql -U admin -d trading_db -c "SELECT * FROM users LIMIT 1;"

# Reinitialize database
docker compose down postgres
docker volume rm lake_postgres_data  # WARNING: Deletes data!
docker compose up -d postgres
sleep 10
docker compose up -d iceberg-init
```

---

### Order Service (Port 8002)

**Problem**: Orders not executing

**Causes**:
1. Redis doesn't have prices
2. Portfolio service not responding
3. Insufficient balance

**Check Redis prices**:
```bash
docker compose exec redis redis-cli
> KEYS price:*
> GET price:BTCUSDT
```

**Publish test price**:
```bash
docker compose exec redis redis-cli SET price:BTCUSDT 50000
```

---

### Analytics Service (Port 8004)

**Problem**: No OHLCV data

**Cause**: Not connected to Iceberg Silver layer (using mock data)

**Temporary solution**: Analytics generates sample data automatically

**Long-term solution**: Implement Silver layer aggregations (see TODO.md)

---

### ML Service (Port 8005)

**Problem**: Predictions too simple

**Cause**: Using random walk model (not real LSTM)

**Solution**: See TODO.md for ML model implementation tasks

---

## Performance Issues

### Slow API responses

**Diagnose**:
```bash
# Check container resource usage
docker stats

# Check slow queries in PostgreSQL
docker compose exec postgres psql -U admin -d trading_db -c "
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;"
```

**Solutions**:
```bash
# Increase container resources in docker-compose.yml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G

# Add indexes to database (already in init-db.sql)

# Enable Redis caching (already implemented)
```

---

## Networking Issues

### Services can't communicate

**Error**: `httpx.ConnectError: [Errno 111] Connection refused`

**Check Docker network**:
```bash
docker network ls
docker network inspect lake_default
```

**Recreate network**:
```bash
docker compose down
docker compose up -d
```

---

## Data Issues

### Lost data after restart

**Cause**: Volumes not persisted

**Check volumes**:
```bash
docker volume ls | grep lake
```

**Verify volume mounts in docker-compose.yml**:
```yaml
volumes:
  postgres_data:
  minio_data:
  kafka_data:
```

---

### Iceberg table corrupted

**Symptoms**: Can't read Iceberg tables

**Solution**:
```bash
# Check MinIO buckets
open http://localhost:9001
# Login: admin / minioadmin

# Reinitialize Iceberg (WARNING: Deletes data!)
docker volume rm lake_minio_data
docker compose up -d minio minio-setup iceberg-init
```

---

## Debug Mode

### Enable verbose logging

**Edit docker-compose.yml**:
```yaml
api-gateway:
  environment:
    - LOG_LEVEL=DEBUG
    - PYTHONUNBUFFERED=1
```

**Restart service**:
```bash
docker compose up -d api-gateway
docker compose logs -f api-gateway
```

---

## Complete Reset

**Nuclear option** (deletes ALL data):
```bash
# Stop all services
docker compose down -v

# Remove volumes
docker volume rm $(docker volume ls -q | grep lake)

# Remove images
docker rmi $(docker images | grep lake | awk '{print $3}')

# Rebuild from scratch
./start.sh
```

---

## Getting Help

### Collect diagnostic information

```bash
# Service status
docker compose ps > diagnostics.txt

# Logs for all services
docker compose logs --tail=100 >> diagnostics.txt

# System info
docker info >> diagnostics.txt
docker version >> diagnostics.txt

# Disk space
df -h >> diagnostics.txt
docker system df >> diagnostics.txt
```

### Check documentation
- [README.md](README.md) - Quick start
- [MICROSERVICES.md](MICROSERVICES.md) - API examples
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [TODO.md](TODO.md) - Known issues

### GitHub Issues
Open an issue at: https://github.com/UTM-Smoking-Zone/lake/issues

Include:
- Error message
- `diagnostics.txt` file
- Steps to reproduce
- Expected vs actual behavior
