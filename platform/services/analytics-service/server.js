const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting: 100 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

const PORT = process.env.PORT || 8004;
const CACHE_TTL = 60; // Cache for 60 seconds

// Validate required environment variables
if (!process.env.POSTGRES_PASSWORD) {
  throw new Error('POSTGRES_PASSWORD environment variable is required');
}

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'lakehouse',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis client setup
let redisClient = null;
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

// Only connect to Redis if not in test mode
if (process.env.NODE_ENV !== 'test') {
  redisClient = redis.createClient({
    socket: {
      host: REDIS_HOST,
      port: REDIS_PORT
    }
  });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  redisClient.on('connect', () => console.log('✅ Redis connected'));

  redisClient.connect().catch(err => {
    console.error('❌ Redis connection failed:', err);
    redisClient = null;
  });
}

console.log(`✅ Analytics Service connecting to: ${process.env.POSTGRES_HOST || 'postgres'}/${process.env.POSTGRES_DB || 'lakehouse'}`);
console.log(`📦 Redis caching: ${redisClient ? 'enabled' : 'disabled'} (${REDIS_HOST}:${REDIS_PORT})`);

function calculateSMA(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function calculateEMA(data, period) {
  const k = 2 / (period + 1);
  const ema = [data[0]];

  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }

  return ema;
}

function calculateRSI(data, period = 14) {
  const gains = [];
  const losses = [];

  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  if (gains.length < period) {
    return 50; // Not enough data
  }

  const avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
  const avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return rsi;
}

function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast = calculateEMA(data, fastPeriod);
  const emaSlow = calculateEMA(data, slowPeriod);

  const macdLine = emaFast.map((val, i) => val - emaSlow[i]);
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((val, i) => val - signalLine[i]);

  return {
    macd: macdLine[macdLine.length - 1],
    signal: signalLine[signalLine.length - 1],
    histogram: histogram[histogram.length - 1]
  };
}

function calculateBollingerBands(data, period = 20, stdDev = 2) {
  const sma = calculateSMA(data, period);
  const bands = [];

  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i - period + 1];
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
    const sd = Math.sqrt(variance);

    bands.push({
      upper: mean + (sd * stdDev),
      middle: mean,
      lower: mean - (sd * stdDev)
    });
  }

  return bands[bands.length - 1];
}

function calculateVolatility(data, period) {
  if (data.length < period + 1) {
    return 0;
  }

  const returns = [];
  for (let i = 1; i < data.length; i++) {
    returns.push((data[i] - data[i - 1]) / data[i - 1]);
  }

  const recentReturns = returns.slice(-period);
  const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
  const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;

  return Math.sqrt(variance) * Math.sqrt(period); // Annualized volatility
}

// Validation middleware
function validateSymbol(req, res, next) {
  const { symbol } = req.params;

  // Symbol validation: only alphanumeric, 2-20 chars
  if (!symbol || !/^[A-Z0-9]{2,20}$/.test(symbol)) {
    return res.status(400).json({ error: 'Invalid symbol format. Use 2-20 uppercase alphanumeric characters.' });
  }

  next();
}

function validateQueryParams(req, res, next) {
  const { interval, limit } = req.query;

  // Interval whitelist
  const validIntervals = ['1m', '5m', '15m', '1h'];
  if (interval && !validIntervals.includes(interval)) {
    return res.status(400).json({ error: 'Invalid interval. Use: 1m, 5m, 15m, or 1h' });
  }

  // Limit validation
  if (limit) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      return res.status(400).json({ error: 'Invalid limit. Use a number between 1 and 1000' });
    }
  }

  next();
}

// Cache middleware
async function cacheMiddleware(req, res, next) {
  if (!redisClient || !redisClient.isOpen) {
    return next();
  }

  const cacheKey = `${req.path}:${JSON.stringify(req.query)}`;

  try {
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    // Store original res.json
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = (data) => {
      redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(data)).catch(err => {
        console.error('Redis setEx error:', err);
      });
      return originalJson(data);
    };

    next();
  } catch (err) {
    console.error('Cache middleware error:', err);
    next();
  }
}

app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'analytics-service',
    timestamp: new Date().toISOString(),
    dependencies: {}
  };

  // Check PostgreSQL
  try {
    await pool.query('SELECT 1');
    health.dependencies.postgres = 'connected';
  } catch (error) {
    health.dependencies.postgres = 'disconnected';
    health.status = 'degraded';
  }

  // Check Redis
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.ping();
      health.dependencies.redis = 'connected';
    } catch (error) {
      health.dependencies.redis = 'disconnected';
    }
  } else {
    health.dependencies.redis = 'disabled';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// NEW SCHEMA: Uses symbol VARCHAR, open_time TIMESTAMPTZ
app.get('/ohlcv/:symbol', validateSymbol, validateQueryParams, cacheMiddleware, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 100 } = req.query;

    // Map interval to table/view
    const tableMap = {
      '1m': 'v_ohlcv_1m',
      '5m': 'v_ohlcv_5m',
      '15m': 'v_ohlcv_15m',
      '1h': 'v_ohlcv_1h'
    };

    const table = tableMap[interval] || 'ohlcv_1h';
    
    // Validate table name is whitelisted to prevent SQL injection
    if (!Object.values(tableMap).includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }

    const limitNum = Math.min(Math.max(parseInt(limit) || 100, 1), 1000);

    const result = await pool.query(`
      SELECT
        symbol,
        open_time,
        open,
        high,
        low,
        close,
        volume,
        close_time,
        trades_count
      FROM ${table}
      WHERE symbol = $1
      ORDER BY open_time DESC
      LIMIT $2
    `, [symbol, limitNum]);
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for this symbol and interval', symbol, interval });
    }

    res.json({
      symbol,
      interval,
      data: result.rows.reverse()
    });
  } catch (error) {
    console.error('OHLCV error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/indicators/:symbol', validateSymbol, validateQueryParams, cacheMiddleware, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', sma_period = 20, ema_period = 12, rsi_period = 14 } = req.query;

    const tableMap = {
      '1m': 'v_ohlcv_1m',
      '5m': 'v_ohlcv_5m',
      '15m': 'v_ohlcv_15m',
      '1h': 'v_ohlcv_1h'
    };

    const table = tableMap[interval] || 'v_ohlcv_1h';
    
    // Validate table name is whitelisted to prevent SQL injection
    if (!Object.values(tableMap).includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    // Validate and constrain technical indicator parameters
    const smaPeriod = Math.min(Math.max(parseInt(sma_period) || 20, 2), 200);
    const emaPeriod = Math.min(Math.max(parseInt(ema_period) || 12, 2), 200);
    const rsiPeriod = Math.min(Math.max(parseInt(rsi_period) || 14, 2), 100);

    const result = await pool.query(`
      SELECT close
      FROM ${table}
      WHERE symbol = $1
      ORDER BY open_time ASC
      LIMIT 200
    `, [symbol]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No price data available', symbol, interval });
    }

    const prices = result.rows.map(row => parseFloat(row.close));
    const sma = calculateSMA(prices, smaPeriod);
    const ema = calculateEMA(prices, emaPeriod);
    const rsi = calculateRSI(prices, rsiPeriod);
    const macd = calculateMACD(prices);

    res.json({
      symbol,
      interval,
      current_price: prices[prices.length - 1],
      indicators: {
        sma: sma[sma.length - 1],
        ema: ema[ema.length - 1],
        rsi: rsi,
        macd: macd
      },
      data_points: prices.length
    });
  } catch (error) {
    console.error('Indicators error:', error);
    res.status(500).json({ error: error.message });
  }
});

// New endpoint for ML model features
app.get('/ml-features/:symbol', validateSymbol, validateQueryParams, cacheMiddleware, async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 200 } = req.query;

    const tableMap = {
      '1m': 'v_ohlcv_1m',
      '5m': 'v_ohlcv_5m',
      '15m': 'v_ohlcv_15m',
      '1h': 'v_ohlcv_1h'
    };

    const table = tableMap[interval] || 'v_ohlcv_1h';
    
    // Validate table name is whitelisted to prevent SQL injection
    if (!Object.values(tableMap).includes(table)) {
      return res.status(400).json({ error: 'Invalid table name' });
    }
    
    const limitNum = Math.min(Math.max(parseInt(limit) || 200, 1), 1000);

    const result = await pool.query(`
      SELECT open_time, high, close
      FROM ${table}
      WHERE symbol = $1
      ORDER BY open_time ASC
      LIMIT $2
    `, [symbol, limitNum]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No OHLCV data found for this symbol' });
    }

    const highs = result.rows.map(row => parseFloat(row.high));
    const closes = result.rows.map(row => parseFloat(row.close));

    // Calculate all required features for ML model
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);

    const bb = calculateBollingerBands(closes, 20);

    const volatility_10d = calculateVolatility(closes, 10);
    const volatility_14d = calculateVolatility(closes, 14);

    const macd_12_26 = calculateMACD(closes, 12, 26, 9);
    const macd_5_35 = calculateMACD(closes, 5, 35, 5);

    const currentPrice = closes[closes.length - 1];
    const currentHigh = highs[highs.length - 1];

    // Derived feature: below_all_sma
    const below_all_sma = currentPrice < sma20[sma20.length - 1] &&
                          currentPrice < sma50[sma50.length - 1] &&
                          currentPrice < sma200[sma200.length - 1];

    res.json({
      symbol,
      interval,
      timestamp: result.rows[result.rows.length - 1].open_time,
      features: {
        high: currentHigh,
        sma_20: sma20[sma20.length - 1],
        sma_50: sma50[sma50.length - 1],
        sma_200: sma200[sma200.length - 1],
        bb_middle: bb.middle,
        bb_upper: bb.upper,
        bb_lower: bb.lower,
        volatility_10d: volatility_10d,
        volatility_14d: volatility_14d,
        macd_12_26: macd_12_26.macd,
        macd_5_35: macd_5_35.macd,
        macd_signal_5_35: macd_5_35.signal,
        below_all_sma: below_all_sma ? 1 : 0
      },
      current_price: currentPrice,
      data_points: closes.length
    });
  } catch (error) {
    console.error('ML features error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Analytics Service running on port ${PORT}`);
  });
}

module.exports = app;
