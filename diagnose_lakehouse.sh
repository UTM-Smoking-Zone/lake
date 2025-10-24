#!/bin/bash

# =============================================================================
# 🔍 LAKEHOUSE PROJECT FULL DIAGNOSTICS
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo ""
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is NOT installed"
        return 1
    fi
}

# =============================================================================
# 1. SYSTEM CHECK
# =============================================================================
print_header "1️⃣  SYSTEM PREREQUISITES"

check_command docker
check_command docker compose || check_command "docker compose"
check_command python3
check_command pip

echo ""
print_info "Docker version:"
docker --version

echo ""
print_info "Docker Compose version:"
docker compose version 2>/dev/null || docker compose --version

echo ""
print_info "Disk space:"
df -h | grep -E "Filesystem|/$"

echo ""
print_info "Memory:"
free -h

# =============================================================================
# 2. DOCKER CONTAINERS STATUS
# =============================================================================
print_header "2️⃣  DOCKER CONTAINERS STATUS"

cd ~/lake 2>/dev/null || cd ./

echo ""
print_info "Running containers:"
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || docker-compose ps

echo ""
print_info "Container resource usage:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" 2>/dev/null || print_warning "Cannot get stats"

# =============================================================================
# 3. KAFKA HEALTH
# =============================================================================
print_header "3️⃣  KAFKA HEALTH CHECK"

if docker ps | grep -q "kafka"; then
    print_success "Kafka container is running"
    
    echo ""
    print_info "Kafka topics:"
    docker exec kafka kafka-topics --list --bootstrap-server localhost:9092 2>/dev/null || print_error "Cannot list Kafka topics"
    
    echo ""
    print_info "Topic 'btcusdt-bybit' details:"
    docker exec kafka kafka-topics --describe \
      --bootstrap-server localhost:9092 \
      --topic btcusdt-bybit 2>/dev/null || print_warning "Topic btcusdt-bybit not found"
    
    echo ""
    print_info "Messages in btcusdt-bybit topic:"
    OFFSETS=$(docker exec kafka kafka-run-class kafka.tools.GetOffsetShell \
      --broker-list localhost:9092 \
      --topic btcusdt-bybit 2>/dev/null)
    
    if [ -n "$OFFSETS" ]; then
        echo "$OFFSETS"
        TOTAL=$(echo "$OFFSETS" | awk -F: '{sum+=$3} END {print sum}')
        print_success "Total messages: $TOTAL"
    else
        print_warning "No messages in topic"
    fi
    
    echo ""
    print_info "Consumer groups:"
    docker exec kafka kafka-consumer-groups --list --bootstrap-server localhost:9092 2>/dev/null || print_warning "No consumer groups"
    
    echo ""
    print_info "Latest 3 messages from Kafka:"
    docker exec kafka kafka-console-consumer \
      --bootstrap-server localhost:9092 \
      --topic btcusdt-bybit \
      --max-messages 3 \
      --timeout-ms 5000 2>/dev/null || print_warning "Cannot read messages"
      
else
    print_error "Kafka container is NOT running"
fi

# =============================================================================
# 4. PRODUCER STATUS
# =============================================================================
print_header "4️⃣  KAFKA PRODUCER STATUS"

if docker ps | grep -q "kafka-producer"; then
    print_success "kafka-producer is running"
    
    echo ""
    print_info "Producer logs (last 10 lines):"
    docker logs kafka-producer --tail 10 2>/dev/null || print_warning "No logs available"
else
    print_error "kafka-producer is NOT running"
fi

echo ""
if docker ps | grep -q "websocket-producer"; then
    print_success "websocket-producer is running"
    
    echo ""
    print_info "WebSocket Producer logs (last 10 lines):"
    docker logs websocket-producer --tail 10 2>/dev/null || print_warning "No logs available"
else
    print_warning "websocket-producer is NOT running (may not be in docker-compose)"
fi

# =============================================================================
# 5. CONSUMER STATUS
# =============================================================================
print_header "5️⃣  KAFKA CONSUMER STATUS"

if docker ps | grep -q "kafka-consumer"; then
    print_success "kafka-consumer is running"
    
    echo ""
    print_info "Consumer process:"
    docker top kafka-consumer 2>/dev/null || print_warning "Cannot get process info"
    
    echo ""
    print_info "Consumer logs (last 20 lines):"
    docker logs kafka-consumer --tail 20 2>/dev/null || print_warning "No logs available"
    
    echo ""
    print_info "Checking for errors in consumer logs:"
    ERROR_COUNT=$(docker logs kafka-consumer 2>&1 | grep -i "error\|exception\|failed" | wc -l)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        print_error "Found $ERROR_COUNT error lines in consumer logs"
        echo ""
        print_info "Recent errors:"
        docker logs kafka-consumer 2>&1 | grep -i "error\|exception\|failed" | tail -5
    else
        print_success "No errors in consumer logs"
    fi
else
    print_error "kafka-consumer is NOT running"
fi

# =============================================================================
# 6. POSTGRESQL DATABASE
# =============================================================================
print_header "6️⃣  POSTGRESQL DATABASE"

if docker ps | grep -q "postgres"; then
    print_success "PostgreSQL container is running"
    
    echo ""
    print_info "Database connection test:"
    docker exec postgres pg_isready -U admin 2>/dev/null && print_success "Database is ready" || print_error "Database not ready"
    
    echo ""
    print_info "Database tables:"
    docker exec postgres psql -U admin -d lakehouse -c "\dt" 2>/dev/null || print_warning "Cannot list tables"
    
    echo ""
    print_info "Iceberg catalog tables:"
    docker exec postgres psql -U admin -d lakehouse -t -c "SELECT * FROM iceberg_tables;" 2>/dev/null || print_warning "No Iceberg tables"
    
    echo ""
    print_info "Checking for bronze_trades table:"
    TABLE_EXISTS=$(docker exec postgres psql -U admin -d lakehouse -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'lakehouse' AND table_name = 'bronze_trades');" 2>/dev/null | xargs)
    
    if [ "$TABLE_EXISTS" = "t" ]; then
        print_success "Table lakehouse.bronze_trades exists"
        
        echo ""
        print_info "Record count:"
        COUNT=$(docker exec postgres psql -U admin -d lakehouse -t -c "SELECT COUNT(*) FROM lakehouse.bronze_trades;" 2>/dev/null | xargs)
        if [ -n "$COUNT" ]; then
            print_success "Total records: $COUNT"
        fi
        
        echo ""
        print_info "Latest 3 trades:"
        docker exec postgres psql -U admin -d lakehouse -c "SELECT symbol, price, timestamp FROM lakehouse.bronze_trades ORDER BY timestamp DESC LIMIT 3;" 2>/dev/null || print_warning "Cannot read trades"
        
        echo ""
        print_info "Data statistics:"
        docker exec postgres psql -U admin -d lakehouse -c "SELECT 
            COUNT(*) as total_trades,
            MIN(price) as min_price,
            MAX(price) as max_price,
            AVG(price)::numeric(10,2) as avg_price,
            COUNT(DISTINCT symbol) as symbols
        FROM lakehouse.bronze_trades;" 2>/dev/null
    else
        print_warning "Table lakehouse.bronze_trades does NOT exist yet"
    fi
else
    print_error "PostgreSQL container is NOT running"
fi

# =============================================================================
# 7. MINIO STORAGE
# =============================================================================
print_header "7️⃣  MINIO STORAGE (S3)"

if docker ps | grep -q "minio"; then
    print_success "MinIO container is running"
    
    echo ""
    print_info "MinIO buckets:"
    docker exec minio-setup mc ls minio/ 2>/dev/null || print_warning "Cannot list buckets (minio-setup may have exited)"
    
    echo ""
    print_info "Warehouse bucket contents:"
    docker exec minio-setup mc ls minio/warehouse/ 2>/dev/null || print_warning "Cannot list warehouse"
    
    echo ""
    print_info "Bronze bucket contents:"
    docker exec minio-setup mc ls minio/bronze/ 2>/dev/null || print_warning "Cannot list bronze"
    
    echo ""
    print_info "MinIO storage stats:"
    docker exec minio-setup mc du minio/ 2>/dev/null || print_warning "Cannot get storage stats"
else
    print_error "MinIO container is NOT running"
fi

# =============================================================================
# 8. SPARK CLUSTER
# =============================================================================
print_header "8️⃣  SPARK CLUSTER"

if docker ps | grep -q "spark-master"; then
    print_success "Spark Master is running"
    print_info "Spark Master UI: http://localhost:8080"
else
    print_error "Spark Master is NOT running"
fi

if docker ps | grep -q "spark-worker"; then
    print_success "Spark Worker is running"
else
    print_error "Spark Worker is NOT running"
fi

# =============================================================================
# 9. WEB INTERFACES
# =============================================================================
print_header "9️⃣  WEB INTERFACES"

check_url() {
    URL=$1
    NAME=$2
    if curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$URL" | grep -q "200\|302"; then
        print_success "$NAME is accessible: $URL"
    else
        print_error "$NAME is NOT accessible: $URL"
    fi
}

check_url "http://localhost:8090" "Kafka UI"
check_url "http://localhost:9001" "MinIO Console"
check_url "http://localhost:8080" "Spark Master UI"
check_url "http://localhost:8501" "Streamlit Dashboard"

# =============================================================================
# 10. NETWORK CONNECTIVITY
# =============================================================================
print_header "🔟 NETWORK CONNECTIVITY"

echo ""
print_info "Testing internal network connectivity:"

# Test Kafka from consumer
if docker ps | grep -q "kafka-consumer"; then
    docker exec kafka-consumer ping -c 1 kafka &>/dev/null && \
        print_success "Consumer → Kafka: OK" || \
        print_error "Consumer → Kafka: FAILED"
    
    docker exec kafka-consumer ping -c 1 postgres &>/dev/null && \
        print_success "Consumer → PostgreSQL: OK" || \
        print_error "Consumer → PostgreSQL: FAILED"
    
    docker exec kafka-consumer ping -c 1 minio &>/dev/null && \
        print_success "Consumer → MinIO: OK" || \
        print_error "Consumer → MinIO: FAILED"
fi

# =============================================================================
# 11. DATA PIPELINE FLOW
# =============================================================================
print_header "1️⃣1️⃣  DATA PIPELINE FLOW"

echo ""
print_info "Checking end-to-end data flow:"

# 1. Producer → Kafka
KAFKA_MESSAGES=0
if docker ps | grep -q "kafka"; then
    KAFKA_MESSAGES=$(docker exec kafka kafka-run-class kafka.tools.GetOffsetShell \
      --broker-list localhost:9092 \
      --topic btcusdt-bybit 2>/dev/null | awk -F: '{sum+=$3} END {print sum}')
fi

if [ "$KAFKA_MESSAGES" -gt 0 ]; then
    print_success "Step 1: Producer → Kafka: $KAFKA_MESSAGES messages"
else
    print_error "Step 1: Producer → Kafka: NO MESSAGES"
fi

# 2. Kafka → Consumer
if docker ps | grep -q "kafka-consumer" && docker logs kafka-consumer 2>&1 | grep -q "Successfully saved"; then
    print_success "Step 2: Kafka → Consumer: WORKING"
else
    print_error "Step 2: Kafka → Consumer: NOT WORKING"
fi

# 3. Consumer → Database
DB_RECORDS=0
if docker ps | grep -q "postgres"; then
    TABLE_EXISTS=$(docker exec postgres psql -U admin -d lakehouse -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'lakehouse' AND table_name = 'bronze_trades');" 2>/dev/null | xargs)
    if [ "$TABLE_EXISTS" = "t" ]; then
        DB_RECORDS=$(docker exec postgres psql -U admin -d lakehouse -t -c "SELECT COUNT(*) FROM lakehouse.bronze_trades;" 2>/dev/null | xargs)
    fi
fi

if [ "$DB_RECORDS" -gt 0 ]; then
    print_success "Step 3: Consumer → Database: $DB_RECORDS records"
else
    print_error "Step 3: Consumer → Database: NO RECORDS"
fi

# 4. Summary
echo ""
if [ "$KAFKA_MESSAGES" -gt 0 ] && [ "$DB_RECORDS" -gt 0 ]; then
    print_success "✨ END-TO-END PIPELINE: WORKING!"
    PERCENTAGE=$(awk "BEGIN {printf \"%.2f\", ($DB_RECORDS/$KAFKA_MESSAGES)*100}")
    print_info "Data ingestion rate: $PERCENTAGE% ($DB_RECORDS/$KAFKA_MESSAGES records)"
else
    print_error "❌ END-TO-END PIPELINE: BROKEN!"
fi

# =============================================================================
# 12. COMMON ISSUES CHECK
# =============================================================================
print_header "1️⃣2️⃣  COMMON ISSUES CHECK"

echo ""
print_info "Checking for common problems:"

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    print_error "Low disk space: ${DISK_USAGE}% used"
else
    print_success "Disk space OK: ${DISK_USAGE}% used"
fi

# Check memory
MEM_AVAILABLE=$(free -m | awk 'NR==2 {print $7}')
if [ "$MEM_AVAILABLE" -lt 1000 ]; then
    print_warning "Low available memory: ${MEM_AVAILABLE}MB"
else
    print_success "Memory OK: ${MEM_AVAILABLE}MB available"
fi

# Check Docker daemon
if systemctl is-active --quiet docker 2>/dev/null; then
    print_success "Docker daemon is active"
else
    print_warning "Cannot check Docker daemon status"
fi

# Check port conflicts
check_port() {
    PORT=$1
    NAME=$2
    if netstat -tuln 2>/dev/null | grep -q ":$PORT " || ss -tuln 2>/dev/null | grep -q ":$PORT "; then
        print_success "Port $PORT ($NAME) is in use"
    else
        print_warning "Port $PORT ($NAME) is NOT in use"
    fi
}

check_port 9092 "Kafka"
check_port 5432 "PostgreSQL"
check_port 9000 "MinIO API"
check_port 8090 "Kafka UI"

# =============================================================================
# 13. RECOMMENDATIONS
# =============================================================================
print_header "1️⃣3️⃣  RECOMMENDATIONS"

echo ""
ISSUES_FOUND=0

# Check if consumer is running
if ! docker ps | grep -q "kafka-consumer"; then
    print_error "Consumer is not running"
    echo "  → Run: docker compose up -d kafka-consumer"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check if consumer has errors
if docker ps | grep -q "kafka-consumer"; then
    ERROR_COUNT=$(docker logs kafka-consumer 2>&1 | grep -i "error\|exception" | wc -l)
    if [ "$ERROR_COUNT" -gt 5 ]; then
        print_error "Consumer has $ERROR_COUNT errors"
        echo "  → Check logs: docker logs kafka-consumer"
        echo "  → Rebuild: docker compose build --no-cache kafka-consumer"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
fi

# Check if data is flowing
if [ "$KAFKA_MESSAGES" -gt 0 ] && [ "$DB_RECORDS" -eq 0 ]; then
    print_error "Data stuck: Kafka has messages but database is empty"
    echo "  → Check consumer logs for errors"
    echo "  → Verify Iceberg table exists"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# Check if producer is sending data
if [ "$KAFKA_MESSAGES" -eq 0 ]; then
    print_error "No data in Kafka"
    echo "  → Check if producer is running: docker ps | grep producer"
    echo "  → Check producer logs: docker logs kafka-producer"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ "$ISSUES_FOUND" -eq 0 ]; then
    echo ""
    print_success "🎉 No critical issues found!"
    echo ""
    print_info "System appears to be healthy"
else
    echo ""
    print_warning "Found $ISSUES_FOUND issue(s) that need attention"
fi

# =============================================================================
# 14. SUMMARY
# =============================================================================
print_header "1️⃣4️⃣  DIAGNOSTIC SUMMARY"

echo ""
echo -e "${CYAN}📊 Quick Stats:${NC}"
echo "  • Kafka Messages: $KAFKA_MESSAGES"
echo "  • Database Records: $DB_RECORDS"
echo "  • Running Containers: $(docker ps --format '{{.Names}}' | wc -l)"
echo "  • Disk Usage: ${DISK_USAGE}%"
echo "  • Available Memory: ${MEM_AVAILABLE}MB"

echo ""
echo -e "${CYAN}🔗 Access Points:${NC}"
echo "  • Kafka UI:        http://localhost:8090"
echo "  • MinIO Console:   http://localhost:9001"
echo "  • Spark UI:        http://localhost:8080"
echo "  • Dashboard:       http://localhost:8501"

echo ""
echo -e "${CYAN}📝 Useful Commands:${NC}"
echo "  • View all logs:        docker compose logs -f"
echo "  • Restart consumer:     docker compose restart kafka-consumer"
echo "  • Rebuild consumer:     docker compose build --no-cache kafka-consumer"
echo "  • Check Kafka topics:   docker exec kafka kafka-topics --list --bootstrap-server localhost:9092"
echo "  • Read Kafka messages:  docker exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic btcusdt-bybit"
echo "  • Connect to DB:        docker exec -it postgres psql -U admin -d lakehouse"

echo ""
print_header "✅ DIAGNOSTICS COMPLETE"

exit 0