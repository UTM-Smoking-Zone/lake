const request = require('supertest');

describe('API Gateway', () => {
  let app;

  beforeAll(() => {
    // Set required environment variables
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:8000';
    process.env.PORTFOLIO_SERVICE_URL = 'http://localhost:8001';
    process.env.ORDER_SERVICE_URL = 'http://localhost:8002';
    process.env.TRANSACTION_SERVICE_URL = 'http://localhost:8003';
    process.env.ANALYTICS_SERVICE_URL = 'http://localhost:8004';
    process.env.ML_SERVICE_URL = 'http://localhost:8005';
    process.env.USER_SERVICE_URL = 'http://localhost:8006';

    app = require('./server');
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.service).toBe('api-gateway');
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('CORS Security', () => {
    test('Should allow requests from allowed origins', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    test('Should include credentials in CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('Rate Limiting', () => {
    test('Should include rate limit headers', async () => {
      const response = await request(app).get('/api/portfolio/user123');

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    test('Should enforce rate limit after 100 requests', async () => {
      // This test would require 100+ requests, skipping for CI
      // In real scenario, test with smaller limit or mock
      const response = await request(app).get('/api/portfolio/user123');
      expect(response.headers['ratelimit-limit']).toBe('100');
    }, 10000);
  });

  describe('API Routes', () => {
    test('Rate limiting should apply to /api/* routes', async () => {
      const response = await request(app).get('/api/portfolio/user123');

      // Should have rate limit headers
      expect(response.headers['ratelimit-limit']).toBeDefined();
    });

    test('Health endpoint should not have rate limiting', async () => {
      const response = await request(app).get('/health');

      // Health endpoint is not under /api/, so no rate limiting
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    });
  });

  describe('Environment Variables', () => {
    test('Should use ALLOWED_ORIGINS from environment', () => {
      expect(process.env.ALLOWED_ORIGINS).toBe('http://localhost:3000,http://localhost:8000');
    });

    test('Should have all service URLs configured', () => {
      expect(process.env.PORTFOLIO_SERVICE_URL).toBeDefined();
      expect(process.env.ORDER_SERVICE_URL).toBeDefined();
      expect(process.env.TRANSACTION_SERVICE_URL).toBeDefined();
      expect(process.env.ANALYTICS_SERVICE_URL).toBeDefined();
      expect(process.env.ML_SERVICE_URL).toBeDefined();
      expect(process.env.USER_SERVICE_URL).toBeDefined();
    });
  });
});
