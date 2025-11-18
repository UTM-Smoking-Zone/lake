#!/bin/bash

# Quick Start Script - Останавливает конфликтующие контейнеры и запускает проект

echo "🚀 Quick Start - Trading Analytics Platform"
echo "==========================================="

# Остановить upgrade проект (если запущен)
echo -e "\n🛑 Stopping conflicting containers from 'upgrade' project..."
cd ~/upgrade 2>/dev/null && docker compose down 2>/dev/null
cd ~/lake

# Остановить наш проект
echo -e "\n🧹 Stopping existing lake containers..."
docker compose down 2>/dev/null

# Запустить проект
echo -e "\n🚀 Starting all services..."
docker compose up -d

echo -e "\n⏳ Waiting for services to start (10 seconds)..."
sleep 10

# Показать статус
echo -e "\n📊 Service Status:"
docker compose ps

echo -e "\n✅ Done! Services are starting."
echo ""
echo "🌐 Service URLs:"
echo "   API Gateway:    http://localhost:8000"
echo "   Kafka UI:       http://localhost:8090"
echo "   MinIO Console:  http://localhost:9011"
echo "   Swagger Docs:   http://localhost:8000/docs"
echo ""
echo "🧪 Test the API:"
echo "   ./test-api.sh"
echo ""
echo "📊 View logs:"
echo "   docker compose logs -f api-gateway"
