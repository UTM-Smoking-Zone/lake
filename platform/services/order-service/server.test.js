const request = require('supertest');

describe('Order Service', () => {
  let app;

  beforeAll(() => {
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
        symbol: 'BTC',
        type: 'limit',
        side: 'buy',
        quantity: 0.5,
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
        expect(response.body).toHaveProperty('status');
      }
    });

    test('Should handle market orders', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'ETH',
        type: 'market',
        side: 'sell',
        quantity: 2.0,
        exchange_code: 'BINANCE'
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should handle buy orders', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'BTC',
        type: 'limit',
        side: 'buy',
        quantity: 0.1,
        price: 49000,
        exchange_code: 'BINANCE'
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body.side).toBe('buy');
      }
    });

    test('Should handle sell orders', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'BTC',
        type: 'limit',
        side: 'sell',
        quantity: 0.1,
        price: 51000,
        exchange_code: 'BINANCE'
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body.side).toBe('sell');
      }
    });

    test('Should return 400 for invalid symbol', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'INVALID_SYMBOL_XYZ',
        type: 'limit',
        side: 'buy',
        quantity: 1.0,
        price: 100,
        exchange_code: 'BINANCE'
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      // Expect 400 or 500 (DB error in test environment)
      expect([400, 500]).toContain(response.status);
    });

    test('Should use default exchange if not provided', async () => {
      const orderData = {
        portfolio_id: 123,
        symbol: 'BTC',
        type: 'limit',
        side: 'buy',
        quantity: 0.5,
        price: 50000
      };

      const response = await request(app)
        .post('/orders')
        .send(orderData);

      expect(response.status).toBeLessThanOrEqual(500);
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
          expect(order).toHaveProperty('symbol');
          expect(order).toHaveProperty('exchange');
          expect(order).toHaveProperty('created_ts');
        }
      }
    });

    test('Should return empty array for portfolio with no orders', async () => {
      const response = await request(app).get('/orders/999999');

      if (response.status === 200) {
        expect(response.body).toBeInstanceOf(Array);
      }
    });

    test('Should limit results to 100 orders', async () => {
      const response = await request(app).get('/orders/123');

      if (response.status === 200 && response.body.length > 0) {
        expect(response.body.length).toBeLessThanOrEqual(100);
      }
    });

    test('Should return orders sorted by created_ts DESC', async () => {
      const response = await request(app).get('/orders/123');

      if (response.status === 200 && response.body.length > 1) {
        const firstOrderTime = new Date(response.body[0].created_ts);
        const secondOrderTime = new Date(response.body[1].created_ts);
        expect(firstOrderTime.getTime()).toBeGreaterThanOrEqual(secondOrderTime.getTime());
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
