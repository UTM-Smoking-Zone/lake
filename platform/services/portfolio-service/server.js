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

// Database pool configuration with limits
const poolConfig = {
  host: process.env.POSTGRES_HOST || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'lakehouse',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
  statement_timeout: 30000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

console.log(`✅ Portfolio Service connecting to: ${process.env.POSTGRES_HOST || 'postgres'}/${process.env.POSTGRES_DB || 'lakehouse'}`);

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
        a.code as base_currency_code,
        p.created_at
      FROM portfolios p
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

    // Get base currency ID from code
    let baseCurrencyId = 3; // Default USDT
    if (base_currency_code) {
      const assetResult = await pool.query(
        'SELECT id FROM assets WHERE code = $1',
        [base_currency_code]
      );
      if (assetResult.rows.length > 0) {
        baseCurrencyId = assetResult.rows[0].id;
      }
    }

    const result = await pool.query(
      'INSERT INTO portfolios (user_id, name, base_currency_id) VALUES ($1, $2, $3) RETURNING *',
      [user_id, name || 'Default Portfolio', baseCurrencyId]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create portfolio error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific portfolio balances
app.get('/portfolio/:portfolioId/balances', async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const userId = req.headers['x-user-id']; // From API Gateway

    // Security: Verify user ID is present
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Security: Verify portfolio belongs to user
    const portfolioResult = await pool.query(
      'SELECT id, name FROM portfolios WHERE id = $1 AND user_id = $2',
      [portfolioId, userId]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(403).json({ error: 'Portfolio not found or access denied' });
    }

    const balancesResult = await pool.query(`
      SELECT
        b.qty,
        b.locked_qty,
        b.updated_at,
        a.code as asset_code,
        a.name as asset_name
      FROM balances b
      JOIN assets a ON b.asset_id = a.id
      WHERE b.portfolio_id = $1
      ORDER BY b.qty DESC, a.code
    `, [portfolioId]);

    res.json({
      portfolio: portfolioResult.rows[0],
      balances: balancesResult.rows
    });
  } catch (error) {
    console.error('Get balances error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update balance (for deposits/withdrawals)
app.post('/portfolio/:portfolioId/balances', async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const { asset_code, quantity, operation } = req.body; // operation: 'add' or 'subtract'
    const userId = req.headers['x-user-id']; // From API Gateway

    // Security: Verify user ID is present
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Security: Verify portfolio belongs to user
    const portfolioResult = await pool.query(
      'SELECT id FROM portfolios WHERE id = $1 AND user_id = $2',
      [portfolioId, userId]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(403).json({ error: 'Portfolio not found or access denied' });
    }

    // Get asset_id
    const assetResult = await pool.query(
      'SELECT id FROM assets WHERE code = $1',
      [asset_code]
    );

    if (assetResult.rows.length === 0) {
      return res.status(400).json({ error: `Asset ${asset_code} not found` });
    }

    const assetId = assetResult.rows[0].id;
    const qty = parseFloat(quantity);

    if (qty <= 0) {
      return res.status(400).json({ error: 'Quantity must be positive' });
    }

    let updateQuery;
    if (operation === 'add') {
      updateQuery = `
        INSERT INTO balances (portfolio_id, asset_id, qty, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (portfolio_id, asset_id)
        DO UPDATE SET qty = balances.qty + $3, updated_at = NOW()
        RETURNING *
      `;
    } else if (operation === 'subtract') {
      updateQuery = `
        INSERT INTO balances (portfolio_id, asset_id, qty, updated_at)
        VALUES ($1, $2, 0, NOW())
        ON CONFLICT (portfolio_id, asset_id)
        DO UPDATE SET qty = GREATEST(balances.qty - $3, 0), updated_at = NOW()
        RETURNING *
      `;
    } else {
      return res.status(400).json({ error: 'Operation must be "add" or "subtract"' });
    }

    const result = await pool.query(updateQuery, [portfolioId, assetId, qty]);
    
    console.log(`✅ Balance ${operation}: ${qty} ${asset_code} for portfolio ${portfolioId}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Portfolio Service running on port ${PORT}`);
  });
}

module.exports = app;
