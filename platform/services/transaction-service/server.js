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
  database: process.env.POSTGRES_DB || 'lakehouse',
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'admin123'
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'transaction-service' });
});

app.get('/trades/:portfolioId', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const result = await pool.query(`
      SELECT
        t.id,
        t.side,
        t.price,
        t.quantity,
        t.notional,
        t.fee_amount,
        t.trade_ts,
        s.symbol,
        e.code as exchange,
        fa.code as fee_asset
      FROM trades t
      JOIN symbols s ON t.symbol_id = s.id
      JOIN exchanges e ON t.exchange_id = e.id
      LEFT JOIN assets fa ON t.fee_asset_id = fa.id
      WHERE t.portfolio_id = $1
      ORDER BY t.trade_ts DESC
      LIMIT $2 OFFSET $3
    `, [req.params.portfolioId, limit, offset]);
    res.json(result.rows);
  } catch (error) {
    console.error('Get trades error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/trades', async (req, res) => {
  try {
    const { portfolio_id, symbol, exchange_code, order_id, side, price, quantity, fee_amount, fee_asset_code, trade_ts } = req.body;

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
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create trade error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Transaction Service running on port ${PORT}`);
});

module.exports = app;
