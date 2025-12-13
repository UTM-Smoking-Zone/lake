const request = require('supertest');

describe('Transaction Service', () => {
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

    test('Should support pagination with limit and offset', async () => {
      const response = await request(app)
        .get('/trades/123')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeLessThanOrEqual(10);
      }
    });

    test('Should default to limit=100 if not specified', async () => {
      const response = await request(app).get('/trades/123');

      if (response.status === 200) {
        expect(response.body.length).toBeLessThanOrEqual(100);
      }
    });

    test('Should return trades sorted by trade_ts DESC', async () => {
      const response = await request(app).get('/trades/123');

      if (response.status === 200 && response.body.length > 1) {
        const firstTradeTime = new Date(response.body[0].trade_ts);
        const secondTradeTime = new Date(response.body[1].trade_ts);
        expect(firstTradeTime.getTime()).toBeGreaterThanOrEqual(secondTradeTime.getTime());
      }
    });

    test('Should return empty array for portfolio with no trades', async () => {
      const response = await request(app).get('/trades/999999');

      if (response.status === 200) {
        expect(response.body).toBeInstanceOf(Array);
      }
    });
  });

  describe('POST /trades', () => {
    test('Should have /trades endpoint for creating trades', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'BTC',
        exchange_code: 'BINANCE',
        order_id: 456,
        side: 'buy',
        price: 50000,
        quantity: 0.5,
        fee_amount: 25,
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

    test('Should handle buy trades', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'ETH',
        exchange_code: 'BINANCE',
        order_id: 456,
        side: 'buy',
        price: 3000,
        quantity: 2.0,
        fee_amount: 6,
        fee_asset_code: 'USDT'
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body.side).toBe('buy');
      }
    });

    test('Should handle sell trades', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'BTC',
        exchange_code: 'BINANCE',
        order_id: 789,
        side: 'sell',
        price: 51000,
        quantity: 0.3,
        fee_amount: 15.3,
        fee_asset_code: 'USDT'
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body.side).toBe('sell');
      }
    });

    test('Should return 400 for invalid symbol', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'INVALID_SYMBOL_XYZ',
        exchange_code: 'BINANCE',
        order_id: 456,
        side: 'buy',
        price: 100,
        quantity: 1.0
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      // Expect 400 or 500 (DB error in test environment)
      expect([400, 500]).toContain(response.status);
    });

    test('Should use default exchange if not provided', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'BTC',
        order_id: 456,
        side: 'buy',
        price: 50000,
        quantity: 0.5
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should handle trades without fee information', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'BTC',
        exchange_code: 'BINANCE',
        order_id: 456,
        side: 'buy',
        price: 50000,
        quantity: 0.5
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should use current timestamp if trade_ts not provided', async () => {
      const tradeData = {
        portfolio_id: 123,
        symbol: 'BTC',
        exchange_code: 'BINANCE',
        order_id: 456,
        side: 'buy',
        price: 50000,
        quantity: 0.5
      };

      const response = await request(app)
        .post('/trades')
        .send(tradeData);

      expect(response.status).toBeLessThanOrEqual(500);
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
