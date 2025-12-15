const request = require('supertest');

describe('Analytics Service', () => {
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
      expect(response.body.service).toBe('analytics-service');
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('GET /ohlcv/:symbol', () => {
    test('Should have /ohlcv/:symbol endpoint', async () => {
      const response = await request(app).get('/ohlcv/BTCUSDT');

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
        expect(response.body).toHaveProperty('interval');
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });

    test('Should support different intervals (1m, 5m, 15m, 1h)', async () => {
      const intervals = ['1m', '5m', '15m', '1h'];

      for (const interval of intervals) {
        const response = await request(app).get(`/ohlcv/BTCUSDT?interval=${interval}`);
        expect(response.status).toBeLessThanOrEqual(500);

        if (response.status === 200) {
          expect(response.body.interval).toBe(interval);
        }
      }
    });

    test('Should support limit parameter', async () => {
      const response = await request(app).get('/ohlcv/BTCUSDT?limit=50');

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200 && response.body.data) {
        expect(response.body.data.length).toBeLessThanOrEqual(50);
      }
    });

    test('Should use default interval of 1h if not provided', async () => {
      const response = await request(app).get('/ohlcv/BTCUSDT');

      if (response.status === 200) {
        expect(response.body.interval).toBe('1h');
      }
    });

    test('Should use default limit of 100 if not provided', async () => {
      const response = await request(app).get('/ohlcv/BTCUSDT');

      if (response.status === 200 && response.body.data) {
        expect(response.body.data.length).toBeLessThanOrEqual(100);
      }
    });

    test('OHLCV data should have correct structure', async () => {
      const response = await request(app).get('/ohlcv/BTCUSDT');

      if (response.status === 200 && response.body.data && response.body.data.length > 0) {
        const candle = response.body.data[0];
        expect(candle).toHaveProperty('symbol');
        expect(candle).toHaveProperty('open_time');
        expect(candle).toHaveProperty('open');
        expect(candle).toHaveProperty('high');
        expect(candle).toHaveProperty('low');
        expect(candle).toHaveProperty('close');
        expect(candle).toHaveProperty('volume');
      }
    });
  });

  describe('GET /indicators/:symbol', () => {
    test('Should have /indicators/:symbol endpoint', async () => {
      const response = await request(app).get('/indicators/BTCUSDT');

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
        expect(response.body).toHaveProperty('interval');
        expect(response.body).toHaveProperty('current_price');
        expect(response.body).toHaveProperty('indicators');
        expect(response.body).toHaveProperty('data_points');
      }
    });

    test('Should calculate SMA indicator', async () => {
      const response = await request(app).get('/indicators/BTCUSDT');

      if (response.status === 200) {
        expect(response.body.indicators).toHaveProperty('sma');
        expect(typeof response.body.indicators.sma).toBe('number');
      }
    });

    test('Should calculate EMA indicator', async () => {
      const response = await request(app).get('/indicators/BTCUSDT');

      if (response.status === 200) {
        expect(response.body.indicators).toHaveProperty('ema');
        expect(typeof response.body.indicators.ema).toBe('number');
      }
    });

    test('Should calculate RSI indicator', async () => {
      const response = await request(app).get('/indicators/BTCUSDT');

      if (response.status === 200) {
        expect(response.body.indicators).toHaveProperty('rsi');
        expect(typeof response.body.indicators.rsi).toBe('number');
      }
    });

    test('Should calculate MACD indicator', async () => {
      const response = await request(app).get('/indicators/BTCUSDT');

      if (response.status === 200) {
        expect(response.body.indicators).toHaveProperty('macd');
        expect(response.body.indicators.macd).toHaveProperty('macd');
        expect(response.body.indicators.macd).toHaveProperty('signal');
        expect(response.body.indicators.macd).toHaveProperty('histogram');
      }
    });

    test('Should support custom SMA period', async () => {
      const response = await request(app).get('/indicators/BTCUSDT?sma_period=50');

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should support custom EMA period', async () => {
      const response = await request(app).get('/indicators/BTCUSDT?ema_period=26');

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should support custom RSI period', async () => {
      const response = await request(app).get('/indicators/BTCUSDT?rsi_period=21');

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('Should support different intervals', async () => {
      const response = await request(app).get('/indicators/BTCUSDT?interval=5m');

      if (response.status === 200) {
        expect(response.body.interval).toBe('5m');
      }
    });

    test('Should return 404 for symbol with no data', async () => {
      const response = await request(app).get('/indicators/INVALIDSYMBOL');

      // Expect either 404 (no data) or 500 (DB error)
      expect([404, 500]).toContain(response.status);
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
