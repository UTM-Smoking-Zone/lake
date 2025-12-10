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
  database: process.env.POSTGRES_DB || 'lakehouse',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'admin123'
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'portfolio-service' });
});

app.get('/portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all portfolios for user with balances and positions
    const portfoliosResult = await pool.query(`
      SELECT
        p.id,
        p.name,
        p.created_at,
        u.email,
        u.display_name,
        a.code as base_currency
      FROM portfolios p
      JOIN users u ON p.user_id = u.id
      JOIN assets a ON p.base_currency_id = a.id
      WHERE p.user_id = $1
    `, [userId]);

    if (portfoliosResult.rows.length === 0) {
      return res.status(404).json({ error: 'No portfolios found for this user' });
    }

    // Get balances for each portfolio
    const portfolios = await Promise.all(portfoliosResult.rows.map(async (portfolio) => {
      const balancesResult = await pool.query(`
        SELECT
          b.qty,
          a.code as asset_code,
          a.name as asset_name
        FROM balances b
        JOIN assets a ON b.asset_id = a.id
        WHERE b.portfolio_id = $1 AND b.qty > 0
      `, [portfolio.id]);

      const positionsResult = await pool.query(`
        SELECT
          pos.qty,
          pos.avg_price,
          s.symbol,
          ba.code as base_asset,
          qa.code as quote_asset
        FROM positions pos
        JOIN symbols s ON pos.symbol_id = s.id
        JOIN assets ba ON s.base_asset_id = ba.id
        JOIN assets qa ON s.quote_asset_id = qa.id
        WHERE pos.portfolio_id = $1 AND pos.qty > 0
      `, [portfolio.id]);

      return {
        ...portfolio,
        balances: balancesResult.rows,
        positions: positionsResult.rows
      };
    }));

    res.json(portfolios);
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/portfolio', async (req, res) => {
  try {
    const { user_id, name, base_currency_code } = req.body;

    // Get base currency ID
    const assetResult = await pool.query(
      'SELECT id FROM assets WHERE code = $1',
      [base_currency_code || 'USD']
    );

    if (assetResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid base currency' });
    }

    const result = await pool.query(
      'INSERT INTO portfolios (user_id, name, base_currency_id) VALUES ($1, $2, $3) RETURNING *',
      [user_id, name || 'Default Portfolio', assetResult.rows[0].id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create portfolio error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Portfolio Service running on port ${PORT}`);
});

module.exports = app;
