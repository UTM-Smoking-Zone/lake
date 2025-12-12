# Microservices Architecture Migration Guide

## 🎯 Overview

Проект переделан с **distributed monolith** на **настоящие микросервисы** с применением паттерна **Database per Service**.

---

## 🏗️ Архитектурные изменения

### ❌ Было (Distributed Monolith):
- **1 PostgreSQL база** для всех сервисов
- Прямые SQL запросы между сервисами
- Tight coupling через shared database
- market-data-service дублировал kafka-producer

### ✅ Стало (True Microservices):
- **5 изолированных PostgreSQL баз**:
  - `postgres-user` (port 5434) - user_service
  - `postgres-portfolio` (port 5435) - portfolio_service
  - `postgres-orders` (port 5436) - order_service
  - `postgres-transactions` (port 5437) - transaction_service
  - `postgres-analytics` (port 5438) - analytics_service (read-only OHLCV data)

- **Event-driven communication** через Kafka
- **No shared database** - каждый сервис владеет своими данными
- **market-data-service удален** (дублирование устранено)

---

## 📦 Изменения в базах данных

### 1. User Service Database (`user_service`)
**Таблицы:**
- `users` - Аутентификация и профили пользователей
- `user_events` - Event sourcing для аудита

**Порт:** 5434

### 2. Portfolio Service Database (`portfolio_service`)
**Таблицы:**
- `portfolios` - Портфели пользователей
- `balances` - Балансы активов
- `assets` - Справочник активов
- `portfolio_events` - Event sourcing

**Порт:** 5435

**Важно:** `user_id` в таблице `portfolios` - это внешняя ссылка (БЕЗ FK constraint), так как user-service имеет свою БД.

### 3. Order Service Database (`order_service`)
**Таблицы:**
- `orders` - Ордера на покупку/продажу
- `order_events` - Event sourcing для ордеров

**Порт:** 5436

**Важно:** `user_id` и `portfolio_id` - внешние ссылки без FK.

### 4. Transaction Service Database (`transaction_service`)
**Таблицы:**
- `transactions` - История транзакций (partitioned by month)
- `transaction_events` - Event sourcing

**Порт:** 5437

**Партиционирование:** По месяцам (2024-12 до 2025-12)

### 5. Analytics Service Database (`analytics_service`)
**Таблицы:**
- `ohlcv_1m` - OHLCV данные (1-минутные свечи)
- `ohlcv_5m`, `ohlcv_15m`, `ohlcv_1h` - Materialized Views

**Порт:** 5438

**Важно:** Read-only БД, пишет только kafka-consumer.

---

## 🔄 Event-Driven Communication

### Kafka Topics:
- `user-events` - События пользователей (регистрация, логин)
- `portfolio-events` - События портфелей (создание, обновление)
- `order-events` - События ордеров (создание, исполнение, отмена)
- `transaction-events` - События транзакций
- `balance-events` - События изменения балансов

### Пример использования (user-service):

```javascript
const { KafkaEventProducer, EventTypes, Topics } = require('../shared/kafka-events');

const kafkaProducer = new KafkaEventProducer(['kafka:9092']);
await kafkaProducer.connect();

// Публикация события создания пользователя
app.post('/users', async (req, res) => {
  const { email, password } = req.body;

  // 1. Создаем пользователя в локальной БД
  const user = await createUser(email, password);

  // 2. Публикуем событие в Kafka
  await kafkaProducer.publishEvent(Topics.USER_EVENTS, {
    type: EventTypes.USER_CREATED,
    aggregateId: user.id,
    userId: user.id,
    data: {
      email: user.email,
      displayName: user.display_name,
    },
  });

  res.json(user);
});
```

### Пример подписки (portfolio-service):

```javascript
// Portfolio service слушает user-events чтобы создать дефолтный портфель
const consumer = kafka.consumer({ groupId: 'portfolio-service' });
await consumer.subscribe({ topic: 'user-events' });

await consumer.run({
  eachMessage: async ({ message }) => {
    const event = JSON.parse(message.value.toString());

    if (event.type === 'user.created') {
      // Создаем дефолтный портфель для нового пользователя
      await createDefaultPortfolio(event.userId);
    }
  },
});
```

---

## 🚀 Миграция данных

### Шаг 1: Остановить старые контейнеры
```bash
docker-compose down
```

### Шаг 2: Удалить старую БД (ОСТОРОЖНО!)
```bash
rm -rf ./data/postgres
```

### Шаг 3: Создать директории для новых БД
```bash
mkdir -p ./data/postgres-user
mkdir -p ./data/postgres-portfolio
mkdir -p ./data/postgres-orders
mkdir -p ./data/postgres-transactions
mkdir -p ./data/postgres-analytics
```

### Шаг 4: Запустить новые контейнеры
```bash
docker-compose up -d
```

### Шаг 5: Проверить статус БД
```bash
# Проверяем все 5 баз данных
docker ps | grep postgres

# Ожидаемый вывод:
# postgres-user
# postgres-portfolio
# postgres-orders
# postgres-transactions
# postgres-analytics
```

### Шаг 6: Проверить подключение
```bash
# User Service DB
docker exec -it postgres-user psql -U admin -d user_service -c "\dt"

# Portfolio Service DB
docker exec -it postgres-portfolio psql -U admin -d portfolio_service -c "\dt"

# Order Service DB
docker exec -it postgres-orders psql -U admin -d order_service -c "\dt"

# Transaction Service DB
docker exec -it postgres-transactions psql -U admin -d transaction_service -c "\dt"

# Analytics Service DB
docker exec -it postgres-analytics psql -U admin -d analytics_service -c "\dt"
```

---

## 📊 Преимущества новой архитектуры

### 1. ✅ Независимое масштабирование
Каждый сервис может масштабироваться отдельно:
```bash
docker-compose up -d --scale order-service=3
```

### 2. ✅ Изоляция сбоев
Если упадет `portfolio-service`, `order-service` продолжит работать.

### 3. ✅ Технологическое разнообразие
Можно использовать разные БД для разных сервисов:
- PostgreSQL для OLTP (users, orders)
- MongoDB для логов (transaction-service)
- Redis для кеширования (analytics-service)

### 4. ✅ Упрощение развертывания
Каждый сервис можно деплоить независимо.

### 5. ✅ Улучшенная безопасность
Нет прямого доступа к чужим данным - только через API/Events.

---

## ⚠️ Challenges и решения

### Challenge 1: Distributed Transactions
**Проблема:** Как обеспечить consistency при создании order + update balance?

**Решение:** **Saga Pattern**
```javascript
// Order Service создает ордер
const order = await createOrder(userId, symbol, quantity);

// Публикуем событие
await kafkaProducer.publishEvent(Topics.ORDER_EVENTS, {
  type: EventTypes.ORDER_CREATED,
  orderId: order.id,
  userId: order.user_id,
  portfolioId: order.portfolio_id,
  data: { symbol, quantity, price },
});

// Portfolio Service слушает order.created и блокирует баланс
// Transaction Service слушает order.filled и создает транзакцию
```

### Challenge 2: Joins между сервисами
**Проблема:** Как получить `user.email` + `portfolio.balance` в одном запросе?

**Решение 1:** API Gateway делает aggregation:
```javascript
// API Gateway
const user = await axios.get(`${USER_SERVICE_URL}/users/${userId}`);
const portfolio = await axios.get(`${PORTFOLIO_SERVICE_URL}/portfolios/${portfolioId}`);

res.json({ user, portfolio });
```

**Решение 2:** CQRS - Read Model в Redis:
```javascript
// При создании user и portfolio - сохраняем denormalized view в Redis
redis.set(`user_portfolio:${userId}`, JSON.stringify({
  email: user.email,
  portfolios: [{ id, name, balance }],
}));
```

### Challenge 3: Data Duplication
**Проблема:** `user_id` хранится в `orders`, `portfolios`, `transactions`.

**Решение:** Event Sourcing обеспечивает eventual consistency:
```javascript
// Если user удален - публикуем user.deleted event
// Все сервисы получают событие и обновляют свои данные
```

---

## 🧪 Тестирование

### 1. Проверка изоляции БД
```bash
# Order service НЕ должен видеть users таблицу
docker exec -it postgres-orders psql -U admin -d order_service -c "SELECT * FROM users;"
# ERROR:  relation "users" does not exist
```

### 2. Проверка Kafka events
```bash
# Создаем пользователя
curl -X POST http://localhost:8006/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Проверяем Kafka UI
open http://localhost:8090
# Topic: user-events должен содержать user.created event
```

### 3. Проверка Kafka consumer
```bash
docker logs kafka-consumer | grep "💾 Wrote"
# Должен писать candles в postgres-analytics
```

---

## 📈 Метрики успеха

| Метрика | Было | Стало |
|---------|------|-------|
| PostgreSQL баз данных | 1 | 5 |
| Coupling между сервисами | High (shared DB) | Low (events only) |
| Точки отказа | 1 DB | 5 isolated DBs |
| Scalability | Limited | Independent |
| Deploy complexity | Simple | Moderate |

---

## 🔜 Следующие шаги

### 1. Добавить Kafka consumers в сервисы
Каждый сервис должен слушать релевантные events:
- `portfolio-service` → слушает `user-events`, `order-events`
- `transaction-service` → слушает `order-events`
- `user-service` → публикует `user-events`

### 2. Реализовать Saga Orchestrator
Для сложных бизнес-процессов (создание ордера + резервирование баланса).

### 3. Добавить Service Mesh (Istio/Linkerd)
Для:
- Service discovery
- Circuit breaker
- Retry logic
- Distributed tracing

### 4. Добавить мониторинг
- Prometheus + Grafana
- Kafka lag monitoring
- Database query performance

---

## 📚 Дополнительные ресурсы

- [Microservices Patterns](https://microservices.io/patterns/index.html)
- [Database per Service Pattern](https://microservices.io/patterns/data/database-per-service.html)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html)
- [KafkaJS Documentation](https://kafka.js.org/)

---

**Автор:** UTM 2025 Team (Nick, Dan, Damian, Valentina)
**Дата:** December 11, 2025
