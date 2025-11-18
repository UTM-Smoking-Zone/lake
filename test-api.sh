#!/bin/bash

# Trading Platform API Test Script
# Usage: ./test-api.sh

set -e  # Exit on error

API="http://localhost:8000"

echo "🚀 Testing Trading Platform Microservices"
echo "=========================================="

# Check if services are running
echo -e "\n🔍 Checking if services are running..."
if ! curl -s --max-time 2 $API/health > /dev/null 2>&1; then
    echo "❌ API Gateway is not running!"
    echo ""
    echo "📋 To start the services, run:"
    echo "   docker compose up -d"
    echo ""
    echo "⏳ Wait 30-60 seconds for all services to start, then run this script again."
    exit 1
fi
echo "✅ API Gateway is running"

# Check all services health
echo -e "\n📊 Checking service health..."
curl -s $API/health | jq
curl -s http://localhost:8001/health | jq
curl -s http://localhost:8002/health | jq
curl -s http://localhost:8003/health | jq
curl -s http://localhost:8004/health | jq
curl -s http://localhost:8005/health | jq
curl -s http://localhost:8006/health | jq

# 1. Create user
echo -e "\n👤 Creating user..."
USER_RESPONSE=$(curl -s -X POST $API/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "trader_test",
    "email": "trader@test.com",
    "full_name": "Test Trader"
  }')
echo $USER_RESPONSE | jq
USER_ID=$(echo $USER_RESPONSE | jq -r '.user_id')

# 2. Create demo wallet
echo -e "\n💰 Creating demo wallet for user $USER_ID..."
WALLET_RESPONSE=$(curl -s -X POST $API/api/users/$USER_ID/demo-wallet \
  -H "Content-Type: application/json" \
  -d '{"initial_balance": 10000}')
echo $WALLET_RESPONSE | jq
PORTFOLIO_ID=$(echo $WALLET_RESPONSE | jq -r '.portfolio_id')

# 3. Get portfolios
echo -e "\n📂 Getting portfolios for user $USER_ID..."
curl -s "$API/api/portfolios?user_id=$USER_ID" | jq

# 4. Get OHLCV data
echo -e "\n📈 Getting OHLCV data for BTCUSDT..."
curl -s "$API/api/analytics/ohlcv?symbol=BTCUSDT&interval=1m&limit=5" | jq

# 5. Get technical indicators
echo -e "\n📊 Getting technical indicators..."
curl -s "$API/api/analytics/indicators?symbol=BTCUSDT&indicators=sma,ema,rsi" | jq

# 6. Place BUY order
echo -e "\n🛒 Placing BUY order..."
ORDER_RESPONSE=$(curl -s -X POST $API/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"portfolio_id\": $PORTFOLIO_ID,
    \"symbol\": \"BTCUSDT\",
    \"side\": \"buy\",
    \"type\": \"market\",
    \"quantity\": 0.01
  }")
echo $ORDER_RESPONSE | jq
ORDER_ID=$(echo $ORDER_RESPONSE | jq -r '.order_id')

# 7. Get orders
echo -e "\n📋 Getting orders for user $USER_ID..."
curl -s "$API/api/orders?user_id=$USER_ID" | jq

# 8. Get transactions
echo -e "\n💳 Getting transactions for user $USER_ID..."
curl -s "$API/api/transactions?user_id=$USER_ID" | jq

# 9. Get portfolio details
echo -e "\n💼 Getting portfolio details..."
curl -s "$API/api/portfolios/$PORTFOLIO_ID" | jq

# 10. Place SELL order
echo -e "\n💰 Placing SELL order..."
curl -s -X POST $API/api/orders \
  -H "Content-Type: application/json" \
  -d "{
    \"portfolio_id\": $PORTFOLIO_ID,
    \"symbol\": \"BTCUSDT\",
    \"side\": \"sell\",
    \"type\": \"market\",
    \"quantity\": 0.005
  }" | jq

# 11. Get ML price prediction
echo -e "\n🤖 Getting ML price prediction..."
curl -s "$API/api/ml/predict?symbol=BTCUSDT&horizon=60" | jq '.predictions[:5]'

# 12. Backtest strategy
echo -e "\n📊 Backtesting SMA crossover strategy..."
curl -s -X POST $API/api/ml/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "BTCUSDT",
    "strategy": "sma_cross",
    "parameters": {"short_period": 20, "long_period": 50},
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "initial_capital": 10000
  }' | jq

echo -e "\n✅ All tests completed!"
