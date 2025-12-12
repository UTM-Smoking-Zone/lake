const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createClient } = require('redis');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

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
  user: process.env.USER_SERVICE_URL || 'http://user-service:8006'
};

app.get('/health', async (req, res) => {
  const isRedisConnected = redisClient.isReady;
  res.json({
    status: 'healthy',
    service: 'api-gateway',
    redis: isRedisConnected ? 'connected' : 'disconnected',
    websocket_clients: io.engine.clientsCount
  });
});

async function proxyRequest(serviceName, path, method = 'GET', data = null) {
  const url = `${services[serviceName]}${path}`;
  try {
    const response = await axios({ method, url, data });
    return response.data;
  } catch (error) {
    throw new Error(`Service ${serviceName} error: ${error.message}`);
  }
}

app.get('/api/portfolio/:userId', async (req, res) => {
  try {
    const data = await proxyRequest('portfolio', `/portfolio/${req.params.userId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const data = await proxyRequest('order', '/orders', 'POST', req.body);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/transactions/:userId', async (req, res) => {
  try {
    const data = await proxyRequest('transaction', `/transactions/${req.params.userId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analytics/indicators', async (req, res) => {
  try {
    const { symbol, indicators } = req.query;
    const data = await proxyRequest('analytics', `/indicators?symbol=${symbol}&indicators=${indicators}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ml/predict', async (req, res) => {
  try {
    const { symbol, horizon } = req.query;
    const data = await proxyRequest('ml', `/predict?symbol=${symbol}&horizon=${horizon}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const data = await proxyRequest('user', `/users/${req.params.userId}`);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

io.on('connection', (socket) => {
  console.log('WebSocket client connected');

  socket.on('subscribe', (channel) => {
    socket.join(channel);
    console.log(`Client subscribed to ${channel}`);
  });

  socket.on('disconnect', () => {
    console.log('WebSocket client disconnected');
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

setInterval(broadcastPriceUpdates, 1000);

httpServer.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

module.exports = app;
