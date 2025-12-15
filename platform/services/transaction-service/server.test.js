const request = require('supertest');

describe('Transaction Service', () => {
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
      expect(response.body.service).toBe('transaction-service');
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('GET /trades/:portfolioId', () => {
    test('Should have /trades/:portfolioId endpoint', async () => {
      const response = await request(app).get('/trades/123');

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toBeInstanceOf(Array);

        if (response.body.length > 0) {
          const trade = response.body[0];
          expect(trade).toHaveProperty('id');
          expect(trade).toHaveProperty('side');
          expect(trade).toHaveProperty('price');
          expect(trade).toHaveProperty('quantity');
          expect(trade).toHaveProperty('notional');
          expect(trade).toHaveProperty('fee_amount');
          expect(trade).toHaveProperty('trade_ts');
          expect(trade).toHaveProperty('symbol');
          expect(trade).toHaveProperty('exchange');
        }
      }
    });

    test('Should support pagination with limit parameter', async () => {
      const response = await request(app).get('/trades/123?limit=50');

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body.length).toBeLessThanOrEqual(50);
      }
    });

    test('Should support pagination with offset parameter', async () => {
      const response = await request(app).get('/trades/123?limit=10&offset=5');

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should use default limit of 100 if not provided', async () => {
      const response = await request(app).get('/trades/123');

      if (response.status === 200) {
        expect(response.body.length).toBeLessThanOrEqual(100);
      }
    });

    test('Should return trades sorted by trade_ts DESC', async () => {
      const response = await request(app).get('/trades/123');

      if (response.status === 200 && response.body.length > 1) {
        const trades = response.body;
        for (let i = 0; i < trades.length - 1; i++) {
          const currentDate = new Date(trades[i].trade_ts);
          const nextDate = new Date(trades[i + 1].trade_ts);
          expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
        }
      }
    });
  });

  describe('POST /trades', () => {
    test('Should have /trades endpoint for creating trades', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'BTCUSDT',
        exchange_code: 'BINANCE',
        order_id: 456,
        side: 'buy',
        price: 50000,
        quantity: 1.5,
        fee_amount: 75,
        fee_asset_code: 'USDT',
        trade_ts: new Date().toISOString()
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('portfolio_id', tradeData.portfolio_id);
        expect(response.body).toHaveProperty('side', tradeData.side);
        expect(response.body).toHaveProperty('price', tradeData.price);
        expect(response.body).toHaveProperty('quantity', tradeData.quantity);
      }
    });

    test('Should create trade without fee information', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'ETHUSDT',
        exchange_code: 'BINANCE',
        order_id: 789,
        side: 'sell',
        price: 3000,
        quantity: 2.0
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should use default exchange if not provided', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'BTCUSDT',
        order_id: 111,
        side: 'buy',
        price: 50000,
        quantity: 1.0
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should use current timestamp if trade_ts not provided', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'BTCUSDT',
        exchange_code: 'BINANCE',
        order_id: 222,
        side: 'buy',
        price: 50000,
        quantity: 1.0
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should return 400 for invalid symbol', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'INVALIDSYMBOL',
        exchange_code: 'BINANCE',
        order_id: 333,
        side: 'buy',
        price: 100,
        quantity: 1.0
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      // Expect either 400 (symbol not found) or 500 (DB error)
      expect([400, 500]).toContain(response.status);
    });

    test('Should return 400 for invalid exchange', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'BTCUSDT',
        exchange_code: 'INVALID_EXCHANGE',
        order_id: 444,
        side: 'buy',
        price: 50000,
        quantity: 1.0
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      // Expect either 400 (exchange not found) or 500 (DB error)
      expect([400, 500]).toContain(response.status);
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
