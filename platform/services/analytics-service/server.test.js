const request = require('supertest');

describe('Analytics Service', () => {
  let app;

  beforeAll(() => {
    app = require('./server');
  });

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.service).toBe('analytics-service');
  });

  test('GET /indicators should return technical indicators', async () => {
    const response = await request(app).get('/indicators?symbol=BTCUSDT&indicators=sma,rsi');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('sma');
    expect(response.body).toHaveProperty('rsi');
  });
});
