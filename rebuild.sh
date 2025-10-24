#!/bin/bash
set -e

echo "🧹 Cleaning up..."
cd ~/lake
docker compose down -v
sudo rm -rf ./data/postgres/* ./data/minio/*
docker rmi lake-kafka-consumer lake-kafka-producer 2>/dev/null || true

echo ""
echo "🔨 Building images..."
docker compose build --no-cache

echo ""
echo "🚀 Starting services..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to start (30s)..."
sleep 30

echo ""
echo "📊 Service Status:"
docker compose ps

echo ""
echo "🔍 Checking Kafka topics..."
docker exec kafka kafka-topics --list --bootstrap-server localhost:9092

echo ""
echo "📈 Checking for messages..."
docker exec kafka kafka-run-class kafka.tools.GetOffsetShell \
  --broker-list localhost:9092 \
  --topic btcusdt-bybit 2>/dev/null || echo "Topic not ready yet"

echo ""
echo "📝 Consumer logs (last 20 lines):"
docker logs kafka-consumer --tail 20

echo ""
echo "📝 Producer logs (last 20 lines):"
docker logs kafka-producer --tail 20

echo ""
echo "✅ Rebuild complete!"
echo ""
echo "📊 To follow logs:"
echo "   docker compose logs -f"
echo "   docker logs -f kafka-consumer"
echo "   docker logs -f kafka-producer"
