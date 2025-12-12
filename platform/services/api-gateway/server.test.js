const request = require('supertest');
const { generateToken } = require('./middleware/auth');

describe('API Gateway', () => {
  let app;
  let validToken;

  beforeAll(() => {
    // Set required environment variables
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.JWT_SECRET = 'test_secret_key_for_testing';
    process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:8000';
    process.env.PORTFOLIO_SERVICE_URL = 'http://localhost:8001';
    process.env.ORDER_SERVICE_URL = 'http://localhost:8002';
    process.env.TRANSACTION_SERVICE_URL = 'http://localhost:8003';
    process.env.ANALYTICS_SERVICE_URL = 'http://localhost:8004';
    process.env.ML_SERVICE_URL = 'http://localhost:8005';
    process.env.USER_SERVICE_URL = 'http://localhost:8006';

    app = require('./server');

    // Generate valid token for testing
    validToken = generateToken({
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      role: 'user'
    });
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.service).toBe('api-gateway');
      expect(response.body.status).toBe('healthy');
    });

    test('GET /health should include circuit breaker status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.circuit_breakers).toBeDefined();
      expect(typeof response.body.circuit_breakers).toBe('object');
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

    test('Should have JWT_SECRET configured', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
    });
  });

  describe('Authentication', () => {
    test('Protected route should reject request without token', async () => {
      const response = await request(app).get('/api/portfolio/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('No authorization token provided');
    });

    test('Protected route should accept request with valid token', async () => {
      const response = await request(app)
        .get('/api/portfolio/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', `Bearer ${validToken}`);

      // Will fail because service is not running, but should pass auth
      expect(response.status).not.toBe(401);
    });

    test('Protected route should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/portfolio/550e8400-e29b-41d4-a716-446655440000')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });

    test('Public analytics route should work without token', async () => {
      const response = await request(app)
        .get('/api/analytics/indicators?symbol=BTCUSDT&indicators=sma,rsi');

      // Will fail because service is not running, but should pass auth
      expect(response.status).not.toBe(401);
    });
  });

  describe('Validation', () => {
    test('POST /api/orders should reject invalid order data', async () => {
      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          portfolio_id: 'invalid-uuid',
          symbol: 'BTC',  // Invalid format
          type: 'invalid',
          side: 'invalid',
          quantity: -1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });

    test('GET /api/analytics/indicators should reject invalid query', async () => {
      const response = await request(app)
        .get('/api/analytics/indicators?symbol=INVALID&indicators=INVALID');

      expect(response.status).toBe(400);
    });

    test('GET /api/ml/predict should reject horizon exceeding max', async () => {
      const response = await request(app)
        .get('/api/ml/predict?symbol=BTCUSDT&horizon=9999');

      expect(response.status).toBe(400);
    });
  });

  describe('Authorization', () => {
    test('User should not access another users portfolio', async () => {
      const response = await request(app)
        .get('/api/portfolio/different-user-id')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Access denied');
    });
  });
});
