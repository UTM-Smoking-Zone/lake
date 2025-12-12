const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8001;

// Validate required environment variables
if (!process.env.POSTGRES_PASSWORD) {
  throw new Error('POSTGRES_PASSWORD environment variable is required');
}

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres-portfolio',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'portfolio_service',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD
});

console.log(`✅ Portfolio Service connecting to: ${process.env.POSTGRES_HOST || 'postgres-portfolio'}/${process.env.POSTGRES_DB || 'portfolio_service'}`);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'portfolio-service' });
});

app.get('/portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get all portfolios for user (no JOIN with users - different database!)
    const portfoliosResult = await pool.query(`
      SELECT
        p.id,
        p.user_id,
        p.name,
        p.base_currency_code,
        p.created_at
      FROM portfolios p
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

      // Positions removed - no symbols table in portfolio_service

      return {
        ...portfolio,
        balances: balancesResult.rows
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

    const result = await pool.query(
      'INSERT INTO portfolios (user_id, name, base_currency_code) VALUES ($1, $2, $3) RETURNING *',
      [user_id, name || 'Default Portfolio', base_currency_code || 'USDT']
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
