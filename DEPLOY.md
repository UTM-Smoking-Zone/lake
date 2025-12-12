# 🚀 Инструкции по Развертыванию Микросервисной Архитектуры

## ⚠️ ВАЖНО: Это разрушающее обновление!

Переход на микросервисную архитектуру **УДАЛИТ все существующие данные** в старой БД.

Перед миграцией:
1. Сделайте backup если нужны данные
2. Остановите все сервисы
3. Удалите старую БД

---

## 📋 Предварительные требования

- Docker 20.10+
- Docker Compose 2.0+
- Минимум 8GB RAM
- Минимум 20GB свободного места

---

## 🛠️ Пошаговое развертывание

### Шаг 1: Остановить старые контейнеры

```bash
cd /home/nicolaedrabcinski/lake

# Останавливаем все контейнеры
docker-compose down

# Проверяем что все остановлено
docker ps
```

**Ожидаемый результат:** Нет запущенных контейнеров.

---

### Шаг 2: Backup старой БД (опционально)

Если нужно сохранить данные:

```bash
# Создаем backup директорию
mkdir -p ./backups/$(date +%Y%m%d)

# Копируем старую БД
cp -r ./data/postgres ./backups/$(date +%Y%m%d)/postgres-old

echo "✅ Backup создан в ./backups/$(date +%Y%m%d)/"
```

---

### Шаг 3: Удалить старую БД

```bash
# ОСТОРОЖНО: Это удалит все данные!
rm -rf ./data/postgres

echo "✅ Старая БД удалена"
```

---

### Шаг 4: Создать директории для новых БД

```bash
# Создаем 5 директорий для Database per Service
mkdir -p ./data/postgres-user
mkdir -p ./data/postgres-portfolio
mkdir -p ./data/postgres-orders
mkdir -p ./data/postgres-transactions
mkdir -p ./data/postgres-analytics

# Проверяем что директории созданы
ls -la ./data/ | grep postgres

# Ожидаемый вывод:
# drwxrwxr-x  postgres-analytics
# drwxrwxr-x  postgres-orders
# drwxrwxr-x  postgres-portfolio
# drwxrwxr-x  postgres-transactions
# drwxrwxr-x  postgres-user
```

---

### Шаг 5: Запустить новую архитектуру

```bash
# Собираем образы (если были изменения в Dockerfile)
docker-compose build

# Запускаем все сервисы
docker-compose up -d

# Следим за логами
docker-compose logs -f
```

**Ожидаемое поведение:**
1. PostgreSQL базы стартуют первыми (5 баз)
2. Kafka, Redis, MinIO поднимаются параллельно
3. Микросервисы ждут готовности БД (healthchecks)
4. API Gateway стартует последним

---

### Шаг 6: Проверить статус контейнеров

```bash
# Проверяем количество контейнеров
docker ps --format "table {{.Names}}\t{{.Status}}" | wc -l
# Ожидаемое: 23 строки (22 контейнера + header)

# Проверяем PostgreSQL базы
docker ps --format "table {{.Names}}\t{{.Status}}" | grep postgres

# Ожидаемый вывод:
postgres-analytics      Up X minutes (healthy)
postgres-transactions   Up X minutes (healthy)
postgres-orders         Up X minutes (healthy)
postgres-portfolio      Up X minutes (healthy)
postgres-user           Up X minutes (healthy)
```

---

### Шаг 7: Проверить healthchecks

```bash
# Проверяем health status всех сервисов
docker ps --filter "health=healthy" --format "{{.Names}}" | wc -l

# Ожидаемое: 13 healthy контейнеров
# (5 PostgreSQL + Kafka + Redis + MinIO + 5 microservices)
```

---

### Шаг 8: Проверить логи микросервисов

```bash
# User Service
docker logs user-service 2>&1 | tail -20

# Ожидаемый вывод:
# ✅ Connected to PostgreSQL user_service successfully
# ✅ Kafka producer connected (user-service)
# Server listening on :8006

# Portfolio Service
docker logs portfolio-service 2>&1 | tail -20

# ✅ Connected to PostgreSQL portfolio_service successfully
# ✅ Kafka producer connected (portfolio-service)
# Server listening on :8001

# Order Service
docker logs order-service 2>&1 | tail -20

# ✅ Connected to PostgreSQL order_service successfully
# ✅ Kafka producer connected (order-service)
# Server listening on :8002

# Transaction Service
docker logs transaction-service 2>&1 | tail -20

# ✅ Connected to PostgreSQL transaction_service successfully
# ✅ Kafka producer connected (transaction-service)
# Server listening on :8003

# Analytics Service
docker logs analytics-service 2>&1 | tail -20

# ✅ Connected to PostgreSQL analytics_service successfully
# Server listening on :8004
```

---

### Шаг 9: Проверить Kafka Consumer

```bash
docker logs kafka-consumer 2>&1 | grep "analytics_service"

# Ожидаемый вывод:
# ✅ Connected to PostgreSQL analytics_service successfully
# 💾 Wrote 10 candles to analytics_service.ohlcv_1m
# 💾 Wrote 15 candles to analytics_service.ohlcv_1m
```

---

### Шаг 10: Проверить таблицы в каждой БД

```bash
# User Service DB
docker exec -it postgres-user psql -U admin -d user_service -c "\dt"

# Ожидаемые таблицы:
#  public | users       | table | admin
#  public | user_events | table | admin

# Portfolio Service DB
docker exec -it postgres-portfolio psql -U admin -d portfolio_service -c "\dt"

# Ожидаемые таблицы:
#  public | assets           | table | admin
#  public | balances         | table | admin
#  public | portfolios       | table | admin
#  public | portfolio_events | table | admin

# Order Service DB
docker exec -it postgres-orders psql -U admin -d order_service -c "\dt"

# Ожидаемые таблицы:
#  public | orders        | table | admin
#  public | order_events  | table | admin

# Transaction Service DB
docker exec -it postgres-transactions psql -U admin -d transaction_service -c "\dt"

# Ожидаемые таблицы:
#  public | transactions         | table | admin (partitioned)
#  public | transaction_events   | table | admin
#  public | transactions_2024_12 | table | admin (partition)
#  public | transactions_2025_01 | table | admin (partition)
#  ... (еще 11 партиций)

# Analytics Service DB
docker exec -it postgres-analytics psql -U admin -d analytics_service -c "\dt"

# Ожидаемые таблицы:
#  public | ohlcv_1m | table | admin

# Проверяем materialized views
docker exec -it postgres-analytics psql -U admin -d analytics_service -c "\dm"

# Ожидаемые MVs:
#  public | ohlcv_5m  | materialized view | admin
#  public | ohlcv_15m | materialized view | admin
#  public | ohlcv_1h  | materialized view | admin
```

---

### Шаг 11: Тестирование API

```bash
# Health check API Gateway
curl http://localhost:8000/health
# {"status":"healthy","service":"api-gateway"}

# Health check User Service
curl http://localhost:8006/health
# {"status":"healthy","service":"user-service"}

# Health check Portfolio Service
curl http://localhost:8001/health
# {"status":"healthy","service":"portfolio-service"}

# Health check Order Service
curl http://localhost:8002/health
# {"status":"healthy","service":"order-service"}

# Health check Transaction Service
curl http://localhost:8003/health
# {"status":"healthy","service":"transaction-service"}

# Health check Analytics Service
curl http://localhost:8004/health
# {"status":"healthy","service":"analytics-service"}
```

---

### Шаг 12: Создать тестового пользователя

```bash
# Регистрация пользователя
curl -X POST http://localhost:8006/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456","display_name":"Test User"}'

# Ожидаемый ответ:
# {"id":1,"email":"test@example.com","display_name":"Test User","created_at":"..."}
```

---

### Шаг 13: Проверить Kafka Events

```bash
# Открываем Kafka UI в браузере
open http://localhost:8090

# Или проверяем через CLI
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic user-events \
  --from-beginning \
  --max-messages 10

# Должны увидеть user.created event
```

---

### Шаг 14: Проверить OHLCV данные

```bash
# Проверяем что kafka-consumer пишет данные
docker exec -it postgres-analytics psql -U admin -d analytics_service \
  -c "SELECT COUNT(*) FROM ohlcv_1m;"

# Ожидаемое: > 0 (количество свечей)

# Проверяем последние свечи
docker exec -it postgres-analytics psql -U admin -d analytics_service \
  -c "SELECT symbol, open_time, close FROM ohlcv_1m ORDER BY open_time DESC LIMIT 5;"

# Ожидаемый вывод:
#   symbol  |        open_time        |   close
# ----------+-------------------------+-----------
#  BTCUSDT  | 2025-12-11 18:45:00+00 | 98234.50
#  BTCUSDT  | 2025-12-11 18:44:00+00 | 98231.20
#  ...
```

---

## 🔧 Troubleshooting

### Проблема 1: Сервис не может подключиться к БД

**Симптомы:**
```
❌ Failed to connect to PostgreSQL: connection refused
```

**Решение:**
```bash
# Проверяем что БД здорова
docker ps | grep postgres-user
# Должен быть (healthy)

# Проверяем логи БД
docker logs postgres-user

# Перезапускаем сервис
docker-compose restart user-service
```

---

### Проблема 2: Kafka consumer не пишет данные

**Симптомы:**
```
⏳ Waiting for messages... (processed: 0, errors: 0)
```

**Решение:**
```bash
# Проверяем что kafka-producer работает
docker logs kafka-producer | tail -20

# Проверяем топик btcusdt-bybit
docker exec -it kafka kafka-topics --list --bootstrap-server localhost:9092 | grep btcusdt

# Проверяем что есть сообщения
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic btcusdt-bybit \
  --max-messages 1

# Перезапускаем kafka-consumer
docker-compose restart kafka-consumer
```

---

### Проблема 3: Healthcheck fails

**Симптомы:**
```
postgres-user    Up X minutes (unhealthy)
```

**Решение:**
```bash
# Проверяем что БД запустилась
docker exec -it postgres-user pg_isready -U admin -d user_service

# Проверяем таблицы
docker exec -it postgres-user psql -U admin -d user_service -c "\dt"

# Если таблиц нет - проверяем init script
docker logs postgres-user | grep "init-user-service.sql"

# Пересоздаем контейнер
docker-compose rm -f postgres-user
docker volume rm lake_postgres-user || true
docker-compose up -d postgres-user
```

---

### Проблема 4: Port already in use

**Симптомы:**
```
Error: bind: address already in use
```

**Решение:**
```bash
# Найти процесс занимающий порт (например 5434)
sudo lsof -i :5434

# Убить процесс
sudo kill -9 <PID>

# Или изменить порт в docker-compose.yml
# Например: "5439:5432" вместо "5434:5432"
```

---

## 📊 Мониторинг

### Проверка использования ресурсов

```bash
# CPU и память всех контейнеров
docker stats --no-stream

# Размер данных БД
du -sh ./data/postgres-*

# Ожидаемое:
# 100M    ./data/postgres-analytics  (больше всего - OHLCV данные)
# 10M     ./data/postgres-user
# 15M     ./data/postgres-portfolio
# 20M     ./data/postgres-orders
# 25M     ./data/postgres-transactions
```

### Проверка Kafka topics

```bash
# Список всех топиков
docker exec -it kafka kafka-topics --list --bootstrap-server localhost:9092

# Ожидаемые топики:
# btcusdt-bybit (trade stream)
# user-events
# portfolio-events
# order-events
# transaction-events
# balance-events
```

### Проверка Kafka lag

```bash
# Через Kafka UI
open http://localhost:8090

# Или через CLI
docker exec -it kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --describe \
  --group lakehouse-consumer
```

---

## 🧹 Очистка (откат)

Если нужно откатиться назад:

```bash
# Останавливаем новую архитектуру
docker-compose down

# Удаляем новые БД
rm -rf ./data/postgres-{user,portfolio,orders,transactions,analytics}

# Восстанавливаем из backup
cp -r ./backups/YYYYMMDD/postgres-old ./data/postgres

# Откатываем docker-compose.yml и init.sql
git checkout docker-compose.yml platform/db/init.sql

# Запускаем старую архитектуру
docker-compose up -d
```

---

## ✅ Критерии успешного развертывания

- [ ] 22 контейнера запущены
- [ ] 13 контейнеров healthy
- [ ] 5 PostgreSQL баз доступны (порты 5434-5438)
- [ ] Все микросервисы отвечают на /health
- [ ] kafka-consumer пишет в postgres-analytics
- [ ] Создан тестовый пользователь
- [ ] Kafka topics созданы (user-events, portfolio-events, etc.)
- [ ] OHLCV данные пишутся в analytics_service.ohlcv_1m
- [ ] Frontend доступен на http://localhost:3000
- [ ] API Gateway доступен на http://localhost:8000

---

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs [service-name]`
2. Проверьте healthchecks: `docker ps`
3. Проверьте connectivity: `docker network inspect lakehouse`
4. Смотрите `/MICROSERVICES_MIGRATION.md` для деталей архитектуры

---

**Команда:** Nick, Dan, Damian, Valentina | UTM 2025
**Дата:** December 11, 2025
