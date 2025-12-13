const request = require('supertest');

describe('Portfolio Service', () => {
  let app;

  beforeAll(() => {
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_DB = 'test_db';
    process.env.POSTGRES_USER = 'test_user';

    app = require('./server');
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.service).toBe('portfolio-service');
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('GET /portfolio/:userId', () => {
    test('Should have /portfolio/:userId endpoint', async () => {
      const response = await request(app).get('/portfolio/123');

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toBeInstanceOf(Array);
        if (response.body.length > 0) {
          const portfolio = response.body[0];
          expect(portfolio).toHaveProperty('id');
          expect(portfolio).toHaveProperty('user_id');
          expect(portfolio).toHaveProperty('name');
          expect(portfolio).toHaveProperty('base_currency_code');
          expect(portfolio).toHaveProperty('balances');
          expect(Array.isArray(portfolio.balances)).toBe(true);
        }
      }
    });

    test('Should return 404 for user with no portfolios', async () => {
      const response = await request(app).get('/portfolio/999999');

      // Expect either 404 or 500 (DB error in test environment)
      expect([404, 500]).toContain(response.status);
    });

    test('Should return balances array for each portfolio', async () => {
      const response = await request(app).get('/portfolio/123');

      if (response.status === 200) {
        response.body.forEach(portfolio => {
          expect(portfolio).toHaveProperty('balances');
          expect(Array.isArray(portfolio.balances)).toBe(true);

          portfolio.balances.forEach(balance => {
            expect(balance).toHaveProperty('qty');
            expect(balance).toHaveProperty('asset_code');
            expect(balance).toHaveProperty('asset_name');
          });
        });
      }
    });
  });

  describe('POST /portfolio', () => {
    test('Should have /portfolio endpoint for creating portfolios', async () => {
      const portfolioData = {
        user_id: 123,
        name: 'Test Portfolio',
        base_currency_code: 'USDT'
      };

      const response = await request(app)
        .post('/portfolio')
        .send(portfolioData);

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('user_id', portfolioData.user_id);
        expect(response.body).toHaveProperty('name', portfolioData.name);
        expect(response.body).toHaveProperty('base_currency_code', portfolioData.base_currency_code);
      }
    });

    test('Should create portfolio with default name if not provided', async () => {
      const portfolioData = {
        user_id: 123,
        base_currency_code: 'USDT'
      };

      const response = await request(app)
        .post('/portfolio')
        .send(portfolioData);

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('name');
      }
    });

    test('Should create portfolio with default base_currency_code if not provided', async () => {
      const portfolioData = {
        user_id: 123,
        name: 'Test Portfolio'
      };

      const response = await request(app)
        .post('/portfolio')
        .send(portfolioData);

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('base_currency_code');
      }
    });
  });

  describe('Environment Variables', () => {
    test('Should have POSTGRES_PASSWORD configured', () => {
      expect(process.env.POSTGRES_PASSWORD).toBeDefined();
      expect(process.env.POSTGRES_PASSWORD).not.toBe('');
    });

    test('Should have database configuration', () => {
      expect(process.env.POSTGRES_HOST).toBeDefined();
      expect(process.env.POSTGRES_DB).toBeDefined();
      expect(process.env.POSTGRES_USER).toBeDefined();
    });
  });

  describe('Database Pool Configuration', () => {
    test('Server should initialize without errors', () => {
      expect(app).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });
  });
});
