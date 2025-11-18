#!/bin/bash

# Trading Platform Startup Script
# Quick start for all microservices

set -e

echo "🚀 Starting Trading Analytics Platform"
echo "======================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo "Please start Docker and try again."
    exit 1
fi

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml not found!"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Stop and remove old containers
echo -e "\n🧹 Cleaning up old containers..."
docker compose down --remove-orphans 2>/dev/null || true

# Build and start services
echo -e "\n🔨 Building Docker images..."
docker compose build --parallel

echo -e "\n🚀 Starting all services..."
docker compose up -d

# Wait for services to be healthy
echo -e "\n⏳ Waiting for services to start (this may take 30-60 seconds)..."
sleep 10

# Check critical services
RETRIES=30
DELAY=2

services=(
    "http://localhost:8000/health:API Gateway"
    "http://localhost:8001/health:Portfolio Service"
    "http://localhost:8002/health:Order Service"
    "http://localhost:8003/health:Transaction Service"
    "http://localhost:8004/health:Analytics Service"
    "http://localhost:8005/health:ML Service"
    "http://localhost:8006/health:User Service"
)

echo ""
for service in "${services[@]}"; do
    IFS=':' read -r url name <<< "$service"
    echo -n "Checking $name... "
    
    for i in $(seq 1 $RETRIES); do
        if curl -s --max-time 2 "$url" > /dev/null 2>&1; then
            echo "✅"
            break
        fi
        
        if [ $i -eq $RETRIES ]; then
            echo "❌ (timeout)"
        else
            sleep $DELAY
        fi
    done
done

# Show running containers
echo -e "\n📦 Running containers:"
docker compose ps

# Show useful URLs
echo -e "\n🌐 Service URLs:"
echo "   API Gateway:    http://localhost:8000"
echo "   Kafka UI:       http://localhost:8090"
echo "   MinIO Console:  http://localhost:9011"
echo "   Spark Master:   http://localhost:8080"
echo ""
echo "📚 API Documentation:"
echo "   Swagger UI:     http://localhost:8000/docs"
echo ""
echo "🧪 To test the API, run:"
echo "   ./test-api.sh"
echo ""
echo "📊 To view logs:"
echo "   docker compose logs -f [service-name]"
echo ""
echo "🛑 To stop all services:"
echo "   docker compose down"
echo ""
echo "✅ Platform is ready!"
