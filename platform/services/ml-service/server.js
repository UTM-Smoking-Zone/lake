const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8005;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'lakehouse',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'admin123'
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'ml-service' });
});

app.get('/predict', async (req, res) => {
  try {
    const { symbol, horizon = 24 } = req.query;

    // Get symbol_id
    const symbolResult = await pool.query(
      'SELECT id FROM symbols WHERE symbol = $1',
      [symbol || 'BTCUSDT']
    );

    if (symbolResult.rows.length === 0) {
      return res.status(404).json({ error: `Symbol ${symbol} not found` });
    }

    const symbolId = symbolResult.rows[0].id;

    // Get latest price from ohlcv_1h
    const priceResult = await pool.query(`
      SELECT close, open_ts
      FROM ohlcv_1h
      WHERE symbol_id = $1
      ORDER BY open_ts DESC
      LIMIT 100
    `, [symbolId]);

    if (priceResult.rows.length === 0) {
      return res.status(404).json({ error: 'No price data available for prediction' });
    }

    const prices = priceResult.rows.reverse().map(row => parseFloat(row.close));
    const currentPrice = prices[prices.length - 1];

    // Simple moving average prediction (placeholder for real ML model)
    const recentPrices = prices.slice(-20);
    const avgPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const trend = (currentPrice - avgPrice) / avgPrice;

    const prediction = currentPrice * (1 + trend * 0.5);
    const confidence = Math.max(0.5, Math.min(0.95, 0.75 - Math.abs(trend) * 2));

    res.json({
      symbol: symbol || 'BTCUSDT',
      horizon: parseInt(horizon),
      current_price: currentPrice,
      predicted_price: prediction,
      confidence: confidence,
      timestamp: new Date().toISOString(),
      data_points: prices.length
    });
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/backtest', async (req, res) => {
  try {
    const { strategy, symbol, start_date, end_date, portfolio_id } = req.body;

    // Get symbol_id
    const symbolResult = await pool.query(
      'SELECT id FROM symbols WHERE symbol = $1',
      [symbol || 'BTCUSDT']
    );

    if (symbolResult.rows.length === 0) {
      return res.status(400).json({ error: `Symbol ${symbol} not found` });
    }

    const symbolId = symbolResult.rows[0].id;

    // Get historical trades for backtesting
    const tradesResult = await pool.query(`
      SELECT
        side,
        price,
        quantity,
        notional,
        fee_amount,
        trade_ts
      FROM trades
      WHERE symbol_id = $1
        AND ($2::bigint IS NULL OR portfolio_id = $2)
        AND ($3::timestamp IS NULL OR trade_ts >= $3)
        AND ($4::timestamp IS NULL OR trade_ts <= $4)
      ORDER BY trade_ts ASC
    `, [symbolId, portfolio_id || null, start_date || null, end_date || null]);

    if (tradesResult.rows.length === 0) {
      return res.json({
        strategy,
        symbol,
        total_return: 0,
        sharpe_ratio: 0,
        max_drawdown: 0,
        win_rate: 0,
        trades: 0,
        message: 'No historical trades found for backtesting'
      });
    }

    // Simple backtest calculation
    let totalPnL = 0;
    let wins = 0;
    let position = 0;
    let entryPrice = 0;

    tradesResult.rows.forEach(trade => {
      const price = parseFloat(trade.price);
      const qty = parseFloat(trade.quantity);
      const fee = parseFloat(trade.fee_amount || 0);

      if (trade.side === 'buy') {
        entryPrice = position === 0 ? price : (entryPrice * position + price * qty) / (position + qty);
        position += qty;
      } else if (trade.side === 'sell' && position > 0) {
        const pnl = (price - entryPrice) * Math.min(qty, position) - fee;
        totalPnL += pnl;
        if (pnl > 0) wins++;
        position = Math.max(0, position - qty);
      }
    });

    const totalTrades = tradesResult.rows.filter(t => t.side === 'sell').length;
    const winRate = totalTrades > 0 ? wins / totalTrades : 0;

    res.json({
      strategy,
      symbol,
      total_return: totalPnL,
      sharpe_ratio: totalTrades > 0 ? (totalPnL / totalTrades) : 0,
      max_drawdown: -Math.abs(totalPnL * 0.2), // Simplified
      win_rate: winRate,
      trades: totalTrades,
      data_points: tradesResult.rows.length
    });
  } catch (error) {
    console.error('Backtest error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`ML Service running on port ${PORT}`);
});

module.exports = app;
