#!/bin/bash

# Script to run all tests for microservices
# Usage: ./run-all-tests.sh

set -e  # Exit on error

echo "🧪 Running all microservice tests..."
echo "======================================"

SERVICES=(
  "api-gateway"
  "user-service"
  "portfolio-service"
  "order-service"
  "transaction-service"
  "analytics-service"
  "ml-service"
)

FAILED_SERVICES=()
PASSED_SERVICES=()

for service in "${SERVICES[@]}"; do
  SERVICE_PATH="platform/services/$service"

  if [ -f "$SERVICE_PATH/package.json" ]; then
    echo ""
    echo "📦 Testing $service..."
    echo "--------------------------------------"

    cd "$SERVICE_PATH"

    # Check if node_modules exists, install if needed
    if [ ! -d "node_modules" ]; then
      echo "Installing dependencies for $service..."
      npm install --silent
    fi

    # Run tests
    if npm test -- --silent --passWithNoTests 2>&1; then
      echo "✅ $service: PASSED"
      PASSED_SERVICES+=("$service")
    else
      echo "❌ $service: FAILED"
      FAILED_SERVICES+=("$service")
    fi

    cd - > /dev/null
  else
    echo "⚠️  $service: No package.json found, skipping..."
  fi
done

echo ""
echo "======================================"
echo "📊 Test Results Summary"
echo "======================================"
echo "✅ Passed: ${#PASSED_SERVICES[@]} services"
for service in "${PASSED_SERVICES[@]}"; do
  echo "   - $service"
done

echo ""
echo "❌ Failed: ${#FAILED_SERVICES[@]} services"
for service in "${FAILED_SERVICES[@]}"; do
  echo "   - $service"
done

echo ""
if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
  echo "🎉 All tests passed!"
  exit 0
else
  echo "💥 Some tests failed. Please check the output above."
  exit 1
fi
