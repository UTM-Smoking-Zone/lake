const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8004;

// Validate required environment variables
if (!process.env.POSTGRES_PASSWORD) {
  throw new Error('POSTGRES_PASSWORD environment variable is required');
}

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres-analytics',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'analytics_service',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD
});

console.log(`✅ Analytics Service connecting to: ${process.env.POSTGRES_HOST || 'postgres-analytics'}/${process.env.POSTGRES_DB || 'analytics_service'}`);

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

function calculateMACD(data) {
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);

  const macdLine = ema12.map((val, i) => val - ema26[i]);
  const signalLine = calculateEMA(macdLine, 9);
  const histogram = macdLine.map((val, i) => val - signalLine[i]);

  return {
    macd: macdLine[macdLine.length - 1],
    signal: signalLine[signalLine.length - 1],
    histogram: histogram[histogram.length - 1]
  };
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'analytics-service' });
});

// NEW SCHEMA: Uses symbol VARCHAR, open_time TIMESTAMPTZ
app.get('/ohlcv/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 100 } = req.query;

    // Map interval to table/view
    const tableMap = {
      '1m': 'ohlcv_1m',
      '5m': 'ohlcv_5m',
      '15m': 'ohlcv_15m',
      '1h': 'ohlcv_1h'
    };

    const table = tableMap[interval] || 'ohlcv_1h';

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
    `, [symbol, parseInt(limit)]);

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

app.get('/indicators/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', sma_period = 20, ema_period = 12, rsi_period = 14 } = req.query;

    const tableMap = {
      '1m': 'ohlcv_1m',
      '5m': 'ohlcv_5m',
      '15m': 'ohlcv_15m',
      '1h': 'ohlcv_1h'
    };

    const table = tableMap[interval] || 'ohlcv_1h';

    const result = await pool.query(`
      SELECT close
      FROM ${table}
      WHERE symbol = $1
      ORDER BY open_time ASC
      LIMIT 200
    `, [symbol]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No OHLCV data found for this symbol' });
    }

    const prices = result.rows.map(row => parseFloat(row.close));
    const sma = calculateSMA(prices, parseInt(sma_period));
    const ema = calculateEMA(prices, parseInt(ema_period));
    const rsi = calculateRSI(prices, parseInt(rsi_period));
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

app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
});

module.exports = app;
