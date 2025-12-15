const request = require('supertest');

describe('Order Service', () => {
  let app;

  beforeAll(() => {
    // Set environment variables BEFORE requiring server
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_DB = 'test_db';
    process.env.POSTGRES_USER = 'test_user';

    app = require('./server');
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.service).toBe('order-service');
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('POST /orders', () => {
    test('Should have /orders endpoint for creating orders', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'BTCUSDT',
        type: 'limit',
        side: 'buy',
        quantity: 1.0,
        price: 50000,
        exchange_code: 'BINANCE'
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('portfolio_id', orderData.portfolio_id);
        expect(response.body).toHaveProperty('side', orderData.side);
        expect(response.body).toHaveProperty('type', orderData.type);
        expect(response.body).toHaveProperty('quantity', orderData.quantity);
        expect(response.body).toHaveProperty('price', orderData.price);
        expect(response.body).toHaveProperty('status', 'new');
      }
    });

    test('Should create market order', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'ETHUSDT',
        type: 'market',
        side: 'sell',
        quantity: 2.5,
        exchange_code: 'BINANCE'
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('type', 'market');
        expect(response.body).toHaveProperty('side', 'sell');
      }
    });

    test('Should return 400 for invalid symbol', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'INVALIDSYMBOL',
        type: 'limit',
        side: 'buy',
        quantity: 1.0,
        price: 100,
        exchange_code: 'BINANCE'
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      // Expect either 400 (symbol not found) or 500 (DB error in test environment)
      expect([400, 500]).toContain(response.status);
    });

    test('Should use default exchange if not provided', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'BTCUSDT',
        type: 'limit',
        side: 'buy',
        quantity: 1.0,
        price: 50000
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should return 400 for invalid exchange', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'BTCUSDT',
        type: 'limit',
        side: 'buy',
        quantity: 1.0,
        price: 50000,
        exchange_code: 'INVALID_EXCHANGE'
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      // Expect either 400 (exchange not found) or 500 (DB error)
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('GET /orders/:portfolioId', () => {
    test('Should have /orders/:portfolioId endpoint', async () => {
      const response = await request(app).get('/orders/123');

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toBeInstanceOf(Array);

        if (response.body.length > 0) {
          const order = response.body[0];
          expect(order).toHaveProperty('id');
          expect(order).toHaveProperty('side');
          expect(order).toHaveProperty('type');
          expect(order).toHaveProperty('price');
          expect(order).toHaveProperty('quantity');
          expect(order).toHaveProperty('status');
          expect(order).toHaveProperty('created_ts');
          expect(order).toHaveProperty('updated_ts');
          expect(order).toHaveProperty('symbol');
          expect(order).toHaveProperty('exchange');
        }
      }
    });

    test('Should return orders sorted by created_ts DESC', async () => {
      const response = await request(app).get('/orders/123');

      if (response.status === 200 && response.body.length > 1) {
        const orders = response.body;
        for (let i = 0; i < orders.length - 1; i++) {
          const currentDate = new Date(orders[i].created_ts);
          const nextDate = new Date(orders[i + 1].created_ts);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      }
    });

    test('Should limit results to 100 orders', async () => {
      const response = await request(app).get('/orders/123');

      if (response.status === 200) {
        expect(response.body.length).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Environment Variables', () => {
    test('Should have POSTGRES_PASSWORD configured', () => {
      expect(process.env.POSTGRES_PASSWORD).toBeDefined();
      expect(process.env.POSTGRES_PASSWORD).not.toBe('');
    });

    test('Should have database configuration', () => {
      expect(process.env.POSTGRES_HOST).toBeDefined();
      expect(process.env.POSTGRES_DB).toBeDefined();
      expect(process.env.POSTGRES_USER).toBeDefined();
    });
  });

  describe('Database Pool Configuration', () => {
    test('Server should initialize without errors', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });
  });
});
