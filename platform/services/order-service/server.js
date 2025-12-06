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
  database: process.env.POSTGRES_DB || 'trading',
  user: process.env.POSTGRES_USER || 'trading_user',
  password: process.env.POSTGRES_PASSWORD || 'trading_pass'
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'order-service' });
});

app.post('/orders', async (req, res) => {
  try {
    const { user_id, symbol, type, side, amount, price } = req.body;
    const result = await pool.query(
      'INSERT INTO orders (user_id, symbol, type, side, amount, price, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [user_id, symbol, type, side, amount, price, 'pending']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});

module.exports = app;
