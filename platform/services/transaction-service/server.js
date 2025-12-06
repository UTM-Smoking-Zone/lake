const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8003;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'trading',
  user: process.env.POSTGRES_USER || 'trading_user',
  password: process.env.POSTGRES_PASSWORD || 'trading_pass'
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'transaction-service' });
});

app.get('/transactions/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/transactions', async (req, res) => {
  try {
    const { user_id, type, symbol, amount, price } = req.body;
    const result = await pool.query(
      'INSERT INTO transactions (user_id, type, symbol, amount, price) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [user_id, type, symbol, amount, price]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Transaction Service running on port ${PORT}`);
});

module.exports = app;
