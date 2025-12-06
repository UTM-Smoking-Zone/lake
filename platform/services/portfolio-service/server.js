const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8001;

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'trading',
  user: process.env.POSTGRES_USER || 'trading_user',
  password: process.env.POSTGRES_PASSWORD || 'trading_pass'
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'portfolio-service' });
});

app.get('/portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      'SELECT * FROM portfolios WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows[0] || { user_id: userId, balance: 10000, positions: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/portfolio', async (req, res) => {
  try {
    const { user_id, balance } = req.body;
    const result = await pool.query(
      'INSERT INTO portfolios (user_id, balance) VALUES ($1, $2) RETURNING *',
      [user_id, balance]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Portfolio Service running on port ${PORT}`);
});

module.exports = app;
