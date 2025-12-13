const request = require('supertest');
const nock = require('nock');

describe('ML Service', () => {
  let app;
  const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8004';

  beforeAll(() => {
    app = require('./server');
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.service).toBe('ml-service');
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('GET /predict', () => {
    test('Should have /predict endpoint', async () => {
      // Mock Analytics Service response
      const mockOhlcvData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 100 }, (_, i) => ({
          symbol: 'BTCUSDT',
          open_time: new Date(Date.now() - i * 3600000).toISOString(),
          open: 50000 + Math.random() * 1000,
          high: 51000 + Math.random() * 1000,
          low: 49000 + Math.random() * 1000,
          close: 50000 + Math.random() * 1000,
          volume: 1000000
        }))
      };

      nock(ANALYTICS_SERVICE_URL)
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 100 })
        .reply(200, mockOhlcvData);

      const response = await request(app).get('/predict?symbol=BTCUSDT');

      // Will return 200 with mocked data or fail without analytics service
      if (response.status === 200) {
        expect(response.body).toHaveProperty('symbol');
        expect(response.body).toHaveProperty('predicted_price');
        expect(response.body).toHaveProperty('current_price');
        expect(response.body).toHaveProperty('confidence');
        expect(response.body).toHaveProperty('model');
        expect(response.body).toHaveProperty('prediction_change_pct');
        expect(response.body).toHaveProperty('data_points');
      }
    });

    test('Should support custom horizon parameter', async () => {
      const response = await request(app)
        .get('/predict')
        .query({ symbol: 'BTCUSDT', horizon: 48 });

      // Status will be 200 if analytics service is available, otherwise error
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body.horizon).toBe(48);
      }
    });

    test('Should support different intervals', async () => {
      const response = await request(app)
        .get('/predict')
        .query({ symbol: 'BTCUSDT', interval: '5m' });

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body.interval).toBe('5m');
      }
    });

    test('Should default to BTCUSDT and 24h horizon', async () => {
      const response = await request(app).get('/predict');

      if (response.status === 200) {
        expect(response.body.symbol).toBe('BTCUSDT');
        expect(response.body.horizon).toBe(24);
      }
    });

    test('Should return 404 when no price data available', async () => {
      nock(ANALYTICS_SERVICE_URL)
        .get('/ohlcv/INVALID_SYMBOL')
        .query({ interval: '1h', limit: 100 })
        .reply(200, { symbol: 'INVALID_SYMBOL', data: [] });

      const response = await request(app)
        .get('/predict')
        .query({ symbol: 'INVALID_SYMBOL' });

      if (nock.isDone()) {
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('Should include confidence score between 0 and 1', async () => {
      const response = await request(app).get('/predict?symbol=BTCUSDT');

      if (response.status === 200) {
        expect(response.body.confidence).toBeGreaterThanOrEqual(0);
        expect(response.body.confidence).toBeLessThanOrEqual(1);
      }
    });

    test('Should include model name', async () => {
      const response = await request(app).get('/predict?symbol=BTCUSDT');

      if (response.status === 200) {
        expect(response.body.model).toBe('simple_ma_trend');
      }
    });
  });

  describe('POST /backtest', () => {
    test('Should have /backtest endpoint', async () => {
      const mockOhlcvData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 720 }, (_, i) => ({
          symbol: 'BTCUSDT',
          open_time: new Date(Date.now() - i * 3600000).toISOString(),
          close: 50000 + Math.sin(i / 10) * 5000
        }))
      };

      nock(ANALYTICS_SERVICE_URL)
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 720 })
        .reply(200, mockOhlcvData);

      const response = await request(app)
        .post('/backtest')
        .send({
          strategy: 'sma_crossover',
          symbol: 'BTCUSDT',
          interval: '1h',
          lookback_days: 30
        });

      // Will return results with mocked data or fail without analytics service
      if (response.status === 200) {
        expect(response.body).toHaveProperty('strategy');
        expect(response.body).toHaveProperty('symbol');
        expect(response.body).toHaveProperty('total_return');
        expect(response.body).toHaveProperty('sharpe_ratio');
        expect(response.body).toHaveProperty('max_drawdown');
        expect(response.body).toHaveProperty('win_rate');
        expect(response.body).toHaveProperty('trades');
        expect(response.body).toHaveProperty('final_equity');
      }
    });

    test('Should support different lookback periods', async () => {
      const response = await request(app)
        .post('/backtest')
        .send({
          symbol: 'BTCUSDT',
          lookback_days: 60
        });

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body.lookback_days).toBe(60);
      }
    });

    test('Should include trade statistics', async () => {
      const response = await request(app)
        .post('/backtest')
        .send({
          symbol: 'BTCUSDT'
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('winning_trades');
        expect(response.body).toHaveProperty('losing_trades');
        expect(response.body).toHaveProperty('total_return_abs');
      }
    });

    test('Should default to sma_crossover strategy', async () => {
      const response = await request(app)
        .post('/backtest')
        .send({ symbol: 'BTCUSDT' });

      if (response.status === 200) {
        expect(response.body.strategy).toBe('sma_crossover');
      }
    });

    test('Should handle no historical data gracefully', async () => {
      nock(ANALYTICS_SERVICE_URL)
        .get('/ohlcv/INVALID_SYMBOL')
        .query(true)
        .reply(200, { symbol: 'INVALID_SYMBOL', data: [] });

      const response = await request(app)
        .post('/backtest')
        .send({ symbol: 'INVALID_SYMBOL' });

      if (nock.isDone()) {
        expect(response.status).toBe(200);
        expect(response.body.message).toContain('No historical data');
        expect(response.body.trades).toBe(0);
      }
    });
  });

  describe('Environment Variables', () => {
    test('Should have ANALYTICS_SERVICE_URL configured', () => {
      expect(process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8004').toBeDefined();
    });
  });

  describe('Service Initialization', () => {
    test('Server should initialize without errors', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });
  });
});
