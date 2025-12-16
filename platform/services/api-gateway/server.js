const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const { authMiddleware, optionalAuth, verifySocketToken } = require('./middleware/auth');
const { validate, schemas } = require('./middleware/validation');
const { protectedRequest, getCircuitBreakerHealth } = require('./middleware/circuitBreaker');

const app = express();
const httpServer = createServer(app);

// CORS configuration - restrict to frontend only
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:8000'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// CSRF protection for mutating requests
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

// Rate limiting - protect against DDoS and brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later.'
});

// Apply rate limiting to all API routes
app.use('/api/', limiter);

const PORT = process.env.PORT || 8000;
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const redisClient = createClient({
  socket: { host: REDIS_HOST, port: REDIS_PORT }
});

redisClient.connect().then(() => {
  console.log('Connected to Redis');
}).catch(console.error);

const services = {
  portfolio: process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio-service:8001',
  order: process.env.ORDER_SERVICE_URL || 'http://order-service:8002',
  transaction: process.env.TRANSACTION_SERVICE_URL || 'http://transaction-service:8003',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8004',
  ml: process.env.ML_SERVICE_URL || 'http://ml-service:8005',
  user: process.env.USER_SERVICE_URL || 'http://user-service:8006',
  mlPrediction: process.env.ML_PREDICTION_SERVICE_URL || 'http://ml-prediction-service:8007'
};

app.get('/health', async (req, res) => {
  const isRedisConnected = redisClient.isReady;
  const circuitBreakers = getCircuitBreakerHealth();

  res.json({
    status: 'healthy',
    service: 'api-gateway',
    redis: isRedisConnected ? 'connected' : 'disconnected',
    websocket_clients: io.engine.clientsCount,
    circuit_breakers: circuitBreakers
  });
});


async function proxyRequest(serviceName, path, method = 'GET', data = null, headers = {}) {
  const serviceUrl = services[serviceName];
  try {
    // Use circuit breaker for resilient service communication
    const result = await protectedRequest(serviceName, serviceUrl, path, method, data, headers);
    return result;
  } catch (error) {
    throw error;
  }
}

// Authentication routes - public, no JWT required
app.post('/api/auth/register', validate(schemas.register), async (req, res) => {
  try {
    const data = await proxyRequest('user', '/register', 'POST', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', validate(schemas.login), async (req, res) => {
  try {
    const data = await proxyRequest('user', '/login', 'POST', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protected routes - JWT authentication required
app.get('/api/portfolio/:userId', authMiddleware, validate(schemas.userId, 'params'), async (req, res) => {
  try {
    // Verify user can only access their own portfolio
    if (req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const data = await proxyRequest('portfolio', `/portfolio/${req.params.userId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', authMiddleware, validate(schemas.createOrder), async (req, res) => {
  try {
    // Add user ID to request body for audit trail
    const orderData = { ...req.body, user_id: req.user.id };
    const data = await proxyRequest('order', '/orders', 'POST', orderData);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Execute order
app.post('/api/orders/:orderId/execute', authMiddleware, async (req, res) => {
  try {
    // Pass user ID in header for ownership verification
    const headers = { 'x-user-id': req.user.id };
    const data = await proxyRequest('order', `/orders/${req.params.orderId}/execute`, 'POST', req.body, headers);
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Cancel order
app.patch('/api/orders/:orderId/cancel', authMiddleware, async (req, res) => {
  try {
    // Pass user ID in header for ownership verification
    const headers = { 'x-user-id': req.user.id };
    const data = await proxyRequest('order', `/orders/${req.params.orderId}/cancel`, 'PATCH', req.body, headers);
    res.json(data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.get('/api/transactions/:userId', authMiddleware, validate(schemas.userId, 'params'), async (req, res) => {
  try {
    // Verify user can only access their own transactions
    if (req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const data = await proxyRequest('transaction', `/transactions/${req.params.userId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics routes - optional authentication (public market data)
app.get('/api/analytics/indicators', optionalAuth, validate(schemas.analyticsQuery, 'query'), async (req, res) => {
  try {
    const { symbol, indicators } = req.query;
    const data = await proxyRequest('analytics', `/indicators?symbol=${symbol}&indicators=${indicators}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ml/predict', optionalAuth, validate(schemas.mlPredictionQuery, 'query'), async (req, res) => {
  try {
    const { symbol, horizon } = req.query;
    const data = await proxyRequest('ml', `/predict?symbol=${symbol}&horizon=${horizon}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics Service routes
app.get('/api/analytics/health', optionalAuth, async (req, res) => {
  try {
    const data = await proxyRequest('analytics', '/health');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/ohlcv/:symbol', optionalAuth, async (req, res) => {
  try {
    const data = await proxyRequest('analytics', `/ohlcv/${req.params.symbol}?${new URLSearchParams(req.query).toString()}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/indicators/:symbol', optionalAuth, async (req, res) => {
  try {
    const data = await proxyRequest('analytics', `/indicators/${req.params.symbol}?${new URLSearchParams(req.query).toString()}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/ml-features/:symbol', optionalAuth, async (req, res) => {
  try {
    const data = await proxyRequest('analytics', `/ml-features/${req.params.symbol}?${new URLSearchParams(req.query).toString()}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ML Prediction Service - Advanced Keras model predictions
app.post('/api/ml/predict-advanced', optionalAuth, async (req, res) => {
  try {
    const data = await proxyRequest('mlPrediction', '/predict', 'POST', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ml/model-info', optionalAuth, async (req, res) => {
  try {
    const data = await proxyRequest('mlPrediction', '/model-info');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId', authMiddleware, validate(schemas.userId, 'params'), async (req, res) => {
  try {
    // Verify user can only access their own profile
    if (req.user.id !== req.params.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const data = await proxyRequest('user', `/users/${req.params.userId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket authentication middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = verifySocketToken(token);
    socket.userId = decoded.id;
    socket.userEmail = decoded.email;
    console.log(`WebSocket authenticated: ${socket.userEmail}`);
    next();
  } catch (err) {
    console.error('WebSocket authentication failed:', err.message);
    next(new Error('Invalid authentication token'));
  }
});

io.on('connection', (socket) => {
  console.log(`WebSocket client connected: ${socket.userEmail}`);

  socket.on('subscribe', (channel) => {
    // Validate channel access based on user
    const allowedChannels = ['prices', `portfolio:${socket.userId}`, `orders:${socket.userId}`];

    if (!allowedChannels.includes(channel)) {
      socket.emit('error', { message: 'Access denied to channel' });
      return;
    }

    socket.join(channel);
    console.log(`Client ${socket.userEmail} subscribed to ${channel}`);
  });

  socket.on('disconnect', () => {
    console.log(`WebSocket client disconnected: ${socket.userEmail}`);
  });
});

async function broadcastPriceUpdates() {
  if (!redisClient.isReady) return;

  try {
    const price = await redisClient.get('price:BTCUSDT');
    if (price) {
      io.to('prices').emit('price_update', {
        symbol: 'BTCUSDT',
        price: parseFloat(price),
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Error broadcasting price:', error);
  }
}

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  setInterval(broadcastPriceUpdates, 1000);

  httpServer.listen(PORT, () => {
    console.log(`API Gateway running on port ${PORT}`);
  });
}

module.exports = app;
