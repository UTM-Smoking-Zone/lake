const request = require('supertest');

describe('API Gateway', () => {
  let app;

  beforeAll(() => {
    process.env.PORTFOLIO_SERVICE_URL = 'http://localhost:8001';
    process.env.ORDER_SERVICE_URL = 'http://localhost:8002';
    app = require('./server');
  });

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.service).toBe('api-gateway');
  });
});
