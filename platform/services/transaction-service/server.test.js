const request = require('supertest');

describe('Transaction Service', () => {
  let app;

  beforeAll(() => {
    app = require('./server');
  });

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.service).toBe('transaction-service');
  });
});
