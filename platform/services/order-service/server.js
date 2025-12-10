const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8002;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'lakehouse',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'admin123'
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

app.post('/orders', async (req, res) => {
  try {
    const { portfolio_id, symbol, type, side, quantity, price, exchange_code } = req.body;

    // Get symbol_id
    const symbolResult = await pool.query(
      'SELECT id FROM symbols WHERE symbol = $1',
      [symbol]
    );

    if (symbolResult.rows.length === 0) {
      return res.status(400).json({ error: `Symbol ${symbol} not found` });
    }

    // Get exchange_id
    const exchangeResult = await pool.query(
      'SELECT id FROM exchanges WHERE code = $1',
      [exchange_code || 'BINANCE']
    );

    if (exchangeResult.rows.length === 0) {
      return res.status(400).json({ error: 'Exchange not found' });
    }

    const result = await pool.query(
      'INSERT INTO orders (portfolio_id, symbol_id, exchange_id, side, type, price, quantity, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [portfolio_id, symbolResult.rows[0].id, exchangeResult.rows[0].id, side, type, price, quantity, 'new']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders/:portfolioId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        o.id,
        o.side,
        o.type,
        o.price,
        o.quantity,
        o.status,
        o.created_ts,
        o.updated_ts,
        s.symbol,
        e.code as exchange
      FROM orders o
      JOIN symbols s ON o.symbol_id = s.id
      JOIN exchanges e ON o.exchange_id = e.id
      WHERE o.portfolio_id = $1
      ORDER BY o.created_ts DESC
      LIMIT 100
    `, [req.params.portfolioId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});

module.exports = app;
