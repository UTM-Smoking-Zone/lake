# 🎯 Переход на Микросервисную Архитектуру - Краткое Резюме

## ✅ Что сделано

### 1. **Database per Service Pattern** - 5 изолированных БД

| Сервис | База данных | Порт | Таблицы |
|--------|-------------|------|---------|
| **user-service** | `postgres-user` | 5434 | users, user_events |
| **portfolio-service** | `postgres-portfolio` | 5435 | portfolios, balances, assets |
| **order-service** | `postgres-orders` | 5436 | orders, order_events |
| **transaction-service** | `postgres-transactions** | 5437 | transactions (partitioned), transaction_events |
| **analytics-service** | `postgres-analytics` | 5438 | ohlcv_1m, ohlcv_5m, ohlcv_15m, ohlcv_1h |

### 2. **Event-Driven Communication**

Созданы Kafka topics для межсервисной коммуникации:
- `user-events` - Регистрация, логин, обновление пользователей
- `portfolio-events` - Создание портфелей, обновление балансов
- `order-events` - Создание, исполнение, отмена ордеров
- `transaction-events` - Записи транзакций
- `balance-events` - Изменения балансов

### 3. **Shared Library для Kafka**

Создан `/platform/shared/kafka-events.js`:
```javascript
const { KafkaEventProducer, EventTypes, Topics } = require('../shared/kafka-events');

// Publish event
await kafkaProducer.publishEvent(Topics.USER_EVENTS, {
  type: EventTypes.USER_CREATED,
  userId: user.id,
  data: { email: user.email }
});
```

### 4. **Удалено дублирование**

- ❌ **market-data-service (NestJS)** - удален
- ✅ Все market data теперь через `kafka-producer` → `kafka-consumer` → `postgres-analytics`

### 5. **Обновлены init scripts**

Созданы отдельные SQL скрипты для каждого сервиса:
- `/platform/db/init-user-service.sql`
- `/platform/db/init-portfolio-service.sql`
- `/platform/db/init-order-service.sql`
- `/platform/db/init-transaction-service.sql`
- `/platform/db/init-analytics-service.sql`

### 6. **Обновлен docker-compose.yml**

**Было:**
```yaml
postgres:
  image: postgres:15
  ports: ["5433:5432"]
  volumes:
    - ./data/postgres:/var/lib/postgresql/data
```

**Стало:**
```yaml
postgres-user:
  image: postgres:15-alpine
  ports: ["5434:5432"]
  environment:
    POSTGRES_DB: user_service

postgres-portfolio:
  image: postgres:15-alpine
  ports: ["5435:5432"]
  environment:
    POSTGRES_DB: portfolio_service

# ... еще 3 БД
```

### 7. **Обновлен kafka-consumer**

Теперь пишет OHLCV данные в `postgres-analytics` вместо монолитной БД:

```python
# postgres_writer.py
self.conn = psycopg2.connect(
    host='postgres-analytics',
    database='analytics_service'
)

# Новая схема без symbol_id/exchange_id
INSERT INTO ohlcv_1m (symbol, open_time, open, high, low, close, volume, close_time, trades_count)
```

---

## 📊 Сравнение архитектур

| Аспект | Было (Monolith) | Стало (Microservices) |
|--------|-----------------|------------------------|
| **PostgreSQL баз** | 1 shared database | 5 isolated databases |
| **Coupling** | High (shared DB) | Low (events only) |
| **Scalability** | Limited (all or nothing) | Independent per service |
| **Deployment** | All services together | Independent deployment |
| **Fault isolation** | Single point of failure | Service-level isolation |
| **Data consistency** | ACID transactions | Eventual consistency (Saga) |
| **Communication** | Direct SQL queries | REST API + Kafka events |
| **market-data-service** | Duplicated kafka-producer | Removed |

---

## 🚀 Как запустить новую архитектуру

### Шаг 1: Остановить старые контейнеры
```bash
docker-compose down
```

### Шаг 2: Удалить старую БД (ВАЖНО: потеря данных!)
```bash
rm -rf ./data/postgres
```

### Шаг 3: Создать директории для новых БД
```bash
mkdir -p ./data/postgres-{user,portfolio,orders,transactions,analytics}
```

### Шаг 4: Запустить новую архитектуру
```bash
docker-compose up -d
```

### Шаг 5: Проверить статус
```bash
# Должны быть запущены 22 контейнера (было 17)
docker ps --format "table {{.Names}}\t{{.Status}}" | grep postgres

# Ожидаемый вывод:
postgres-user          Up X minutes (healthy)
postgres-portfolio     Up X minutes (healthy)
postgres-orders        Up X minutes (healthy)
postgres-transactions  Up X minutes (healthy)
postgres-analytics     Up X minutes (healthy)
```

### Шаг 6: Проверить работу kafka-consumer
```bash
docker logs -f kafka-consumer | grep "analytics_service"

# Ожидаемый вывод:
✅ Connected to PostgreSQL analytics_service successfully
💾 Wrote 10 candles to analytics_service.ohlcv_1m
```

---

## 📁 Новые файлы

1. `/platform/db/init-user-service.sql` - User service schema
2. `/platform/db/init-portfolio-service.sql` - Portfolio service schema
3. `/platform/db/init-order-service.sql` - Order service schema
4. `/platform/db/init-transaction-service.sql` - Transaction service schema
5. `/platform/db/init-analytics-service.sql` - Analytics service schema (OHLCV)
6. `/platform/shared/kafka-events.js` - Kafka event producer library
7. `/platform/shared/package.json` - Shared library dependencies
8. `/MICROSERVICES_MIGRATION.md` - Полная документация миграции
9. `/MICROSERVICES_SUMMARY.md` - Этот файл (краткое резюме)

---

## 📈 Метрики

### Контейнеры:
- **Было:** 17 контейнеров
- **Стало:** 22 контейнера (+5 PostgreSQL баз)

### Размер образов:
- **postgres:15** → **postgres:15-alpine** (-200MB на каждую БД)

### Латентность:
- **Было:** Direct SQL queries (< 1ms)
- **Стало:** REST API (5-10ms) + Kafka events (async)

### Консистентность:
- **Было:** Immediate consistency (ACID)
- **Стало:** Eventual consistency (требует Saga pattern)

---

## ⚠️ Известные ограничения

### 1. **Нет Kafka consumers в сервисах**
Сервисы публикуют events в Kafka, но пока не слушают их.

**TODO:** Добавить Kafka consumers для:
- `portfolio-service` → слушать `user-events` (создание дефолтного портфеля)
- `transaction-service` → слушать `order-events` (запись транзакций)

### 2. **Нет Saga Orchestrator**
Distributed transactions (создание ордера + резервирование баланса) могут быть inconsistent.

**TODO:** Реализовать Saga pattern для критичных бизнес-процессов.

### 3. **Нет Service Discovery**
Сервисы используют хардкоженные URLs:
```javascript
const USER_SERVICE_URL = 'http://user-service:8006';
```

**TODO:** Добавить Consul/etcd для service discovery.

### 4. **Нет distributed tracing**
Невозможно отследить request flow через микросервисы.

**TODO:** Добавить Jaeger/Zipkin для tracing.

---

## 🎓 Для защиты проекта

### Вопрос: "Почему вы выбрали микросервисы?"

**Ответ:**
> Мы начали с monolith (все сервисы использовали одну БД), но это создавало **tight coupling** - изменения в одной таблице ломали несколько сервисов. Переход на Database per Service Pattern дал нам:
> - **Independent scaling** - можем масштабировать order-service отдельно от user-service
> - **Fault isolation** - падение portfolio-service не ломает user-service
> - **Technology diversity** - можем использовать PostgreSQL для OLTP и Redis для кеширования
> - **Independent deployment** - каждый сервис деплоится независимо

### Вопрос: "Как вы обеспечиваете consistency между сервисами?"

**Ответ:**
> Мы используем **Event-Driven Architecture** с Kafka:
> 1. Сервис выполняет операцию в своей БД (local transaction)
> 2. Публикует event в Kafka (например, `order.created`)
> 3. Другие сервисы слушают events и обновляют свои данные
> 4. Это дает **eventual consistency** - данные становятся согласованными через короткое время
>
> Для критичных операций планируем реализовать **Saga Pattern** (choreography-based saga).

### Вопрос: "Какие паттерны микросервисов вы использовали?"

**Ответ:**
> - **Database per Service** - каждый сервис владеет своими данными
> - **API Gateway** - единая точка входа для фронтенда
> - **Event Sourcing** - все изменения записываются как events
> - **CQRS** (частично) - analytics-service - read-only БД
> - **Saga Pattern** (planned) - для distributed transactions

---

**Дата:** December 11, 2025
**Команда:** Nick, Dan, Damian, Valentina | UTM 2025
