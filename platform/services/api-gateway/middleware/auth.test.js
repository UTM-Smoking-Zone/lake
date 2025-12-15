const { authMiddleware, optionalAuth, verifySocketToken, generateToken } = require('./auth');

describe('Authentication Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('authMiddleware', () => {
    test('Should reject request without authorization header', () => {
      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'No authorization header',
        message: 'Please provide a valid JWT token'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('Should reject request with invalid token format', () => {
      req.headers.authorization = 'InvalidFormat';

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('Should accept valid JWT token', () => {
      const token = generateToken({ id: 'user123', email: 'test@example.com', role: 'user' });
      req.headers.authorization = `Bearer ${token}`;

      authMiddleware(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user123');
      expect(req.user.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
    });

    test('Should reject expired token', () => {
      const token = generateToken({ id: 'user123', email: 'test@example.com' }, '0s');

      // Wait a bit to ensure token expires
      setTimeout(() => {
        req.headers.authorization = `Bearer ${token}`;
        authMiddleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
      }, 100);
    });
  });

  describe('optionalAuth', () => {
    test('Should continue without authentication if no token provided', () => {
      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    test('Should authenticate if valid token provided', () => {
      const token = generateToken({ id: 'user123', email: 'test@example.com' });
      req.headers.authorization = `Bearer ${token}`;

      optionalAuth(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('user123');
      expect(next).toHaveBeenCalled();
    });

    test('Should continue without authentication if invalid token provided', () => {
      req.headers.authorization = 'Bearer invalid_token';

      optionalAuth(req, res, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('verifySocketToken', () => {
    test('Should verify valid token', () => {
      const token = generateToken({ id: 'user123', email: 'test@example.com' });
      const decoded = verifySocketToken(token);

      expect(decoded.id).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
    });

    test('Should throw error for invalid token', () => {
      expect(() => {
        verifySocketToken('invalid_token');
      }).toThrow();
    });
  });

  describe('generateToken', () => {
    test('Should generate valid JWT token', () => {
      const user = { id: 'user123', email: 'test@example.com', role: 'admin' };
      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = verifySocketToken(token);
      expect(decoded.id).toBe('user123');
      expect(decoded.email).toBe('test@example.com');
    });

    test('Should generate token with custom expiration', () => {
      const user = { id: 'user123', email: 'test@example.com' };
      const token = generateToken(user, '1h');

      expect(token).toBeDefined();

      const decoded = verifySocketToken(token);
      expect(decoded.id).toBe('user123');
    });
  });
});
