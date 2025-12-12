const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret-change-in-production';

/**
 * JWT Authentication Middleware
 * Verifies JWT token from Authorization header
 */
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'No authorization header',
        message: 'Please provide a valid JWT token'
      });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authorization header must contain a Bearer token'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    req.user = {
      id: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user'
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please login again'
      });
    }

    return res.status(500).json({
      error: 'Authentication error',
      message: error.message
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that work both with/without auth
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return next();
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: decoded.id || decoded.userId,
        email: decoded.email,
        role: decoded.role || 'user'
      };
    }

    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};

/**
 * Generate JWT token for a user
 */
const generateToken = (user, expiresIn = '24h') => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role || 'user'
    },
    JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Verify WebSocket JWT token
 */
const verifySocketToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

module.exports = {
  authMiddleware,
  optionalAuth,
  generateToken,
  verifySocketToken,
  JWT_SECRET
};
