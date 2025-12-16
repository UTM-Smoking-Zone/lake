const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8003;

// Validate required environment variables
if (!process.env.POSTGRES_PASSWORD) {
  throw new Error('POSTGRES_PASSWORD environment variable is required');
}

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

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'transaction-service' });
});

app.get('/trades/:portfolioId', async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const { limit = 100, offset = 0 } = req.query;
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

    const result = await pool.query(`
      SELECT
        t.id,
        t.side,
        t.price,
        t.quantity,
        t.notional,
        t.fee_amount,
        t.trade_ts,
        t.external_trade_id,
        t.order_id,
        s.symbol,
        e.code as exchange
      FROM trades t
      JOIN symbols s ON t.symbol_id = s.id
      JOIN exchanges e ON t.exchange_id = e.id
      WHERE t.portfolio_id = $1
      ORDER BY t.trade_ts DESC
      LIMIT $2 OFFSET $3
    `, [portfolioId, limit, offset]);
    
    console.log(`ℹ️ Retrieved ${result.rows.length} trades for portfolio ${portfolioId}`);
    res.json(result.rows);
  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/trades', async (req, res) => {
  try {
    const { portfolio_id, symbol, exchange_code, order_id, side, price, quantity, fee_amount, fee_asset_code, trade_ts } = req.body;
    const userId = req.headers['x-user-id']; // From API Gateway

    // Security: Verify user ID is present
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Security: Verify portfolio belongs to user
    const portfolioResult = await pool.query(
      'SELECT id FROM portfolios WHERE id = $1 AND user_id = $2',
      [portfolio_id, userId]
    );

    if (portfolioResult.rows.length === 0) {
      return res.status(403).json({ error: 'Portfolio not found or access denied' });
    }

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

    // Get fee_asset_id if provided
    let feeAssetId = null;
    if (fee_asset_code) {
      const feeAssetResult = await pool.query(
        'SELECT id FROM assets WHERE code = $1',
        [fee_asset_code]
      );
      if (feeAssetResult.rows.length > 0) {
        feeAssetId = feeAssetResult.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO trades (portfolio_id, symbol_id, exchange_id, order_id, external_trade_id, side, price, quantity, fee_asset_id, fee_amount, trade_ts)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [portfolio_id, symbolResult.rows[0].id, exchangeResult.rows[0].id, order_id, `manual_${Date.now()}`, side, price, quantity, feeAssetId, fee_amount, trade_ts || new Date()]
    );
    
    console.log(`✅ Trade created: ${result.rows[0].id} for user ${userId}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create trade error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's transactions history
app.get('/transactions/:portfolioId', async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const { limit = 100, offset = 0, type } = req.query;
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

    let query = `
      SELECT
        'trade' as transaction_type,
        t.id,
        t.side,
        t.price,
        t.quantity,
        t.notional as amount,
        t.fee_amount,
        t.trade_ts as created_at,
        s.symbol,
        e.code as exchange,
        t.order_id
      FROM trades t
      JOIN symbols s ON t.symbol_id = s.id
      JOIN exchanges e ON t.exchange_id = e.id
      WHERE t.portfolio_id = $1
    `;

    let params = [portfolioId];
    
    if (type) {
      // For now we only have 'trade' type in our schema
      if (type !== 'trade') {
        return res.json([]);
      }
    }

    query += ` ORDER BY t.trade_ts DESC LIMIT $2 OFFSET $3`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    console.log(`ℹ️ Retrieved ${result.rows.length} transactions for portfolio ${portfolioId}`);
    res.json(result.rows);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Transaction Service running on port ${PORT}`);
  });
}

module.exports = app;
