const request = require('supertest');

describe('ML Service', () => {
  let app;

  beforeAll(() => {
    app = require('./server');
  });

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.service).toBe('ml-service');
  });

  test('GET /predict should return price prediction', async () => {
    const response = await request(app).get('/predict?symbol=BTCUSDT&horizon=60');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('predicted_price');
    expect(response.body).toHaveProperty('confidence');
  });
});
