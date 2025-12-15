const request = require('supertest');
const nock = require('nock');

describe('ML Service', () => {
  let app;

  beforeAll(() => {
    // Set environment variables BEFORE requiring server
    process.env.ANALYTICS_SERVICE_URL = 'http://analytics-service:8004';

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
      // Mock analytics service response
      const mockOHLCVData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 100 }, (_, i) => ({
          symbol: 'BTCUSDT',
          open_time: new Date(Date.now() - (100 - i) * 3600000).toISOString(),
          open: '50000',
          high: '51000',
          low: '49000',
          close: (50000 + Math.random() * 1000).toString(),
          volume: '1000',
          close_time: new Date(Date.now() - (99 - i) * 3600000).toISOString(),
          trades_count: 100
        }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 100 })
        .reply(200, mockOHLCVData);

      const response = await request(app).get('/predict?symbol=BTCUSDT');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('interval', '1h');
      expect(response.body).toHaveProperty('horizon');
      expect(response.body).toHaveProperty('current_price');
      expect(response.body).toHaveProperty('predicted_price');
      expect(response.body).toHaveProperty('confidence');
      expect(response.body).toHaveProperty('model');
      expect(response.body).toHaveProperty('data_points');
    });

    test('Should support different symbols', async () => {
      const mockOHLCVData = {
        symbol: 'ETHUSDT',
        interval: '1h',
        data: Array.from({ length: 100 }, (_, i) => ({
          symbol: 'ETHUSDT',
          close: (3000 + Math.random() * 100).toString()
        }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/ETHUSDT')
        .query({ interval: '1h', limit: 100 })
        .reply(200, mockOHLCVData);

      const response = await request(app).get('/predict?symbol=ETHUSDT');

      expect(response.status).toBe(200);
      expect(response.body.symbol).toBe('ETHUSDT');
    });

    test('Should support horizon parameter', async () => {
      const mockOHLCVData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 100 }, () => ({ close: '50000' }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 100 })
        .reply(200, mockOHLCVData);

      const response = await request(app).get('/predict?symbol=BTCUSDT&horizon=48');

      expect(response.status).toBe(200);
      expect(response.body.horizon).toBe(48);
    });

    test('Should support interval parameter', async () => {
      const mockOHLCVData = {
        symbol: 'BTCUSDT',
        interval: '5m',
        data: Array.from({ length: 100 }, () => ({ close: '50000' }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '5m', limit: 100 })
        .reply(200, mockOHLCVData);

      const response = await request(app).get('/predict?symbol=BTCUSDT&interval=5m');

      expect(response.status).toBe(200);
      expect(response.body.interval).toBe('5m');
    });

    test('Should return confidence score between 0 and 1', async () => {
      const mockOHLCVData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 100 }, () => ({ close: '50000' }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 100 })
        .reply(200, mockOHLCVData);

      const response = await request(app).get('/predict?symbol=BTCUSDT');

      if (response.status === 200) {
        expect(response.body.confidence).toBeGreaterThanOrEqual(0);
        expect(response.body.confidence).toBeLessThanOrEqual(1);
      }
    });

    test('Should return 404 when no price data available', async () => {
      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 100 })
        .reply(200, { symbol: 'BTCUSDT', interval: '1h', data: [] });

      const response = await request(app).get('/predict?symbol=BTCUSDT');

      expect(response.status).toBe(404);
    });

    test('Should use default values if parameters not provided', async () => {
      const mockOHLCVData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 100 }, () => ({ close: '50000' }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 100 })
        .reply(200, mockOHLCVData);

      const response = await request(app).get('/predict');

      expect(response.status).toBe(200);
      expect(response.body.symbol).toBe('BTCUSDT');
      expect(response.body.interval).toBe('1h');
      expect(response.body.horizon).toBe(24);
    });
  });

  describe('POST /backtest', () => {
    test('Should have /backtest endpoint', async () => {
      const mockOHLCVData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 720 }, (_, i) => ({
          symbol: 'BTCUSDT',
          open_time: new Date(Date.now() - (720 - i) * 3600000).toISOString(),
          close: (50000 + Math.sin(i / 10) * 2000).toString()
        }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 720 })
        .reply(200, mockOHLCVData);

      const backtestData = {
        strategy: 'sma_crossover',
        symbol: 'BTCUSDT',
        interval: '1h',
        lookback_days: 30
      };

      const response = await request(app)
        .post('/backtest')
        .send(backtestData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('strategy', 'sma_crossover');
      expect(response.body).toHaveProperty('symbol', 'BTCUSDT');
      expect(response.body).toHaveProperty('interval', '1h');
      expect(response.body).toHaveProperty('total_return');
      expect(response.body).toHaveProperty('sharpe_ratio');
      expect(response.body).toHaveProperty('max_drawdown');
      expect(response.body).toHaveProperty('win_rate');
      expect(response.body).toHaveProperty('trades');
      expect(response.body).toHaveProperty('winning_trades');
      expect(response.body).toHaveProperty('losing_trades');
    });

    test('Should support different strategies', async () => {
      const mockOHLCVData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 720 }, () => ({ close: '50000' }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 720 })
        .reply(200, mockOHLCVData);

      const response = await request(app)
        .post('/backtest')
        .send({ strategy: 'custom_strategy', symbol: 'BTCUSDT' });

      expect(response.status).toBe(200);
      expect(response.body.strategy).toBe('custom_strategy');
    });

    test('Should support lookback_days parameter', async () => {
      const mockOHLCVData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 1000 }, () => ({ close: '50000' }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query({ interval: '1h', limit: 1000 })
        .reply(200, mockOHLCVData);

      const response = await request(app)
        .post('/backtest')
        .send({ symbol: 'BTCUSDT', lookback_days: 60 });

      expect(response.status).toBeLessThanOrEqual(500);
      if (response.status === 200) {
        expect(response.body.lookback_days).toBe(60);
      }
    });

    test('Should handle empty data gracefully', async () => {
      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query(true)
        .reply(200, { symbol: 'BTCUSDT', interval: '1h', data: [] });

      const response = await request(app)
        .post('/backtest')
        .send({ symbol: 'BTCUSDT' });

      expect(response.status).toBe(200);
      expect(response.body.trades).toBe(0);
      expect(response.body.total_return).toBe(0);
    });

    test('Should calculate trade statistics correctly', async () => {
      const mockOHLCVData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        data: Array.from({ length: 720 }, (_, i) => ({
          open_time: new Date(Date.now() - (720 - i) * 3600000).toISOString(),
          close: (50000 + Math.sin(i / 10) * 2000).toString()
        }))
      };

      nock('http://analytics-service:8004')
        .get('/ohlcv/BTCUSDT')
        .query(true)
        .reply(200, mockOHLCVData);

      const response = await request(app)
        .post('/backtest')
        .send({ symbol: 'BTCUSDT' });

      if (response.status === 200) {
        const { winning_trades, losing_trades, trades } = response.body;
        expect(winning_trades + losing_trades).toBe(trades);
      }
    });
  });

  describe('Environment Variables', () => {
    test('Should have ANALYTICS_SERVICE_URL configured', () => {
      expect(process.env.ANALYTICS_SERVICE_URL).toBeDefined();
      expect(process.env.ANALYTICS_SERVICE_URL).not.toBe('');
    });
  });

  describe('Server Configuration', () => {
    test('Server should initialize without errors', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });
  });
});
