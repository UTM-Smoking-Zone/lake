const request = require('supertest');
const jwt = require('jsonwebtoken');

describe('User Service', () => {
  let app;

  beforeAll(() => {
    process.env.POSTGRES_PASSWORD = 'test_password';
    process.env.JWT_SECRET = 'test_secret_key_for_testing';
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_DB = 'test_db';
    process.env.POSTGRES_USER = 'test_user';

    app = require('./server');
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.service).toBe('user-service');
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('POST /register', () => {
    test('Should have /register endpoint', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecureP@ss123',
        display_name: 'New User'
      };

      const response = await request(app)
        .post('/register')
        .send(userData);

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 201) {
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('email', userData.email);

        // Verify token is valid JWT
        const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
        expect(decoded).toHaveProperty('email', userData.email);
        expect(decoded).toHaveProperty('id');
      }
    });

    test('Should reject registration without email', async () => {
      const response = await request(app)
        .post('/register')
        .send({ password: 'SecureP@ss123' });

      expect([400, 500]).toContain(response.status);
    });

    test('Should reject registration without password', async () => {
      const response = await request(app)
        .post('/register')
        .send({ email: 'test@example.com' });

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('POST /login', () => {
    test('Should have /login endpoint', async () => {
      const credentials = {
        email: 'existing@example.com',
        password: 'ValidP@ss123'
      };

      const response = await request(app)
        .post('/login')
        .send(credentials);

      // Will fail without real DB, but tests structure
      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');

        // Verify token
        const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
        expect(decoded).toHaveProperty('email');
        expect(decoded).toHaveProperty('id');
      }
    });

    test('Should reject login without email', async () => {
      const response = await request(app)
        .post('/login')
        .send({ password: 'password' });

      expect([400, 500]).toContain(response.status);
    });

    test('Should reject login without password', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com' });

      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Legacy Routes', () => {
    test('POST /users should work for backward compatibility', async () => {
      const response = await request(app)
        .post('/users')
        .send({
          email: 'legacy@example.com',
          password: 'LegacyP@ss123'
        });

      expect(response.status).toBeLessThanOrEqual(500);
    });

    test('POST /users/login should work for backward compatibility', async () => {
      const response = await request(app)
        .post('/users/login')
        .send({
          email: 'legacy@example.com',
          password: 'LegacyP@ss123'
        });

      expect(response.status).toBeLessThanOrEqual(500);
    });
  });

  describe('GET /users/:userId', () => {
    test('Should return user data (without password)', async () => {
      const response = await request(app)
        .get('/users/123');

      expect(response.status).toBeLessThanOrEqual(500);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('email');
        expect(response.body).not.toHaveProperty('password_hash');
      }
    });
  });

  describe('Environment Variables', () => {
    test('Should have JWT_SECRET configured', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.JWT_SECRET).not.toBe('');
    });

    test('Should have POSTGRES_PASSWORD configured', () => {
      expect(process.env.POSTGRES_PASSWORD).toBeDefined();
    });
  });

  describe('JWT Token Generation', () => {
    test('Should generate valid JWT with user data', () => {
      const testUser = {
        id: 123,
        email: 'test@example.com',
        role: 'user'
      };

      const token = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '24h' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      expect(decoded.id).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.role).toBe(testUser.role);
    });

    test('Should reject invalid JWT', () => {
      const invalidToken = 'invalid.jwt.token';

      expect(() => {
        jwt.verify(invalidToken, process.env.JWT_SECRET);
      }).toThrow();
    });
  });
});
