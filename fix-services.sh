#!/bin/bash
# Script to fix all microservices database connections

echo "🔧 Fixing microservices database connections..."

# Fix order-service
sed -i "s/process.env.POSTGRES_HOST || 'postgres'/process.env.POSTGRES_HOST || 'postgres-orders'/g" platform/services/order-service/server.js
sed -i "s/process.env.POSTGRES_DB || 'lakehouse'/process.env.POSTGRES_DB || 'order_service'/g" platform/services/order-service/server.js

# Fix transaction-service
sed -i "s/process.env.POSTGRES_HOST || 'postgres'/process.env.POSTGRES_HOST || 'postgres-transactions'/g" platform/services/transaction-service/server.js
sed -i "s/process.env.POSTGRES_DB || 'lakehouse'/process.env.POSTGRES_DB || 'transaction_service'/g" platform/services/transaction-service/server.js

# Fix analytics-service
sed -i "s/process.env.POSTGRES_HOST || 'postgres'/process.env.POSTGRES_HOST || 'postgres-analytics'/g" platform/services/analytics-service/server.js
sed -i "s/process.env.POSTGRES_DB || 'lakehouse'/process.env.POSTGRES_DB || 'analytics_service'/g" platform/services/analytics-service/server.js

echo "✅ Database connections fixed!"
