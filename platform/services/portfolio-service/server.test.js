const request = require('supertest');

describe('Portfolio Service', () => {
  let app;

  beforeAll(() => {
    app = require('./server');
  });

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.service).toBe('portfolio-service');
  });

  test('GET /portfolio/:userId should return portfolio', async () => {
    const response = await request(app).get('/portfolio/test-user');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user_id');
  });
});
