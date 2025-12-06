const request = require('supertest');

describe('User Service', () => {
  let app;

  beforeAll(() => {
    app = require('./server');
  });

  test('GET /health should return healthy status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.service).toBe('user-service');
  });

  test('GET /users/:userId should return user', async () => {
    const response = await request(app).get('/users/test-user');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
  });
});
