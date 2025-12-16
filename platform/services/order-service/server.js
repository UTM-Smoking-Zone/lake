const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8002;

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
  res.json({ status: 'healthy', service: 'order-service' });
});

app.post('/orders', async (req, res) => {
  try {
    const { portfolio_id, symbol, type, side, quantity, price, exchange_code } = req.body;
    const userId = req.headers['x-user-id']; // From API Gateway

    // Security: Verify user ID is present
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Verify portfolio belongs to user
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

    // Generate unique external_order_id
    const externalOrderId = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const result = await pool.query(
      'INSERT INTO orders (portfolio_id, symbol_id, exchange_id, side, type, price, quantity, status, external_order_id, created_ts, updated_ts) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *',
      [portfolio_id, symbolResult.rows[0].id, exchangeResult.rows[0].id, side, type, price, quantity, 'new', externalOrderId]
    );
    
    console.log(`✅ Order created: ${result.rows[0].id} for user ${userId}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders/:portfolioId', async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const userId = req.headers['x-user-id']; // From API Gateway
    const { limit = 100, offset = 0 } = req.query;

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
        o.id,
        o.side,
        o.type,
        o.price,
        o.quantity,
        o.status,
        o.created_ts,
        o.updated_ts,
        o.external_order_id,
        s.symbol,
        e.code as exchange
      FROM orders o
      JOIN symbols s ON o.symbol_id = s.id
      JOIN exchanges e ON o.exchange_id = e.id
      WHERE o.portfolio_id = $1
      ORDER BY o.created_ts DESC
      LIMIT $2 OFFSET $3
    `, [portfolioId, limit, offset]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute order (fills market order immediately)
app.post('/orders/:orderId/execute', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { orderId } = req.params;
    const { execution_price } = req.body; // Price at which order was filled
    const userId = req.headers['x-user-id']; // User ID from API Gateway

    // Security: Verify user ID is present
    if (!userId) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Get order details and verify ownership
    const orderResult = await client.query(`
      SELECT o.*, s.symbol, s.base_asset_id, s.quote_asset_id, p.user_id, e.code as exchange_code
      FROM orders o
      JOIN symbols s ON o.symbol_id = s.id
      JOIN portfolios p ON o.portfolio_id = p.id
      JOIN exchanges e ON o.exchange_id = e.id
      WHERE o.id = $1 AND o.status IN ('new', 'open') AND p.user_id = $2
      FOR UPDATE
    `, [orderId, userId]);

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found, already executed, or access denied' });
    }

    const order = orderResult.rows[0];
    const fillPrice = execution_price || order.price || 0;
    const notional = fillPrice * parseFloat(order.quantity);

    // Check if user has sufficient balance
    if (order.side === 'buy') {
      // Buying crypto: need quote asset (e.g., USDT)
      const balanceResult = await client.query(
        'SELECT qty FROM balances WHERE portfolio_id = $1 AND asset_id = $2',
        [order.portfolio_id, order.quote_asset_id]
      );

      const availableBalance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].qty) : 0;

      if (availableBalance < notional) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Insufficient balance',
          required: notional,
          available: availableBalance
        });
      }

      // Deduct quote asset
      await client.query(`
        INSERT INTO balances (portfolio_id, asset_id, qty, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (portfolio_id, asset_id)
        DO UPDATE SET qty = balances.qty - $3, updated_at = NOW()
      `, [order.portfolio_id, order.quote_asset_id, notional]);

      // Add base asset
      await client.query(`
        INSERT INTO balances (portfolio_id, asset_id, qty, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (portfolio_id, asset_id)
        DO UPDATE SET qty = balances.qty + $3, updated_at = NOW()
      `, [order.portfolio_id, order.base_asset_id, order.quantity]);

    } else {
      // Selling crypto: need base asset (e.g., BTC)
      const balanceResult = await client.query(
        'SELECT qty FROM balances WHERE portfolio_id = $1 AND asset_id = $2',
        [order.portfolio_id, order.base_asset_id]
      );

      const availableBalance = balanceResult.rows.length > 0 ? parseFloat(balanceResult.rows[0].qty) : 0;
      const requiredQuantity = parseFloat(order.quantity);

      console.log(`🔍 SELL Balance Check for ${order.symbol}:`);
      console.log(`  - Portfolio ID: ${order.portfolio_id}`);
      console.log(`  - Base Asset ID: ${order.base_asset_id}`);
      console.log(`  - Available Balance: ${availableBalance}`);
      console.log(`  - Required Quantity: ${requiredQuantity}`);
      console.log(`  - Balance rows found: ${balanceResult.rows.length}`);

      if (availableBalance < requiredQuantity) {
        await client.query('ROLLBACK');
        console.log(`❌ Insufficient balance: ${availableBalance} < ${requiredQuantity}`);
        return res.status(400).json({
          error: 'Insufficient balance',
          required: requiredQuantity,
          available: availableBalance
        });
      }

      // Deduct base asset
      await client.query(`
        INSERT INTO balances (portfolio_id, asset_id, qty, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (portfolio_id, asset_id)
        DO UPDATE SET qty = balances.qty - $3, updated_at = NOW()
      `, [order.portfolio_id, order.base_asset_id, order.quantity]);

      // Add quote asset
      await client.query(`
        INSERT INTO balances (portfolio_id, asset_id, qty, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (portfolio_id, asset_id)
        DO UPDATE SET qty = balances.qty + $3, updated_at = NOW()
      `, [order.portfolio_id, order.quote_asset_id, notional]);
    }

    // Update order status
    await client.query(
      'UPDATE orders SET status = $1, updated_ts = NOW() WHERE id = $2',
      ['filled', orderId]
    );

    // Create trade record in trades table
    const tradeResult = await client.query(`
      INSERT INTO trades (
        portfolio_id, symbol_id, exchange_id, order_id,
        external_trade_id, side, price, quantity, trade_ts
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id
    `, [
      order.portfolio_id,
      order.symbol_id,
      order.exchange_id,
      orderId,
      `exec_${orderId}_${Date.now()}`,
      order.side,
      fillPrice,
      order.quantity
    ]);

    const tradeId = tradeResult.rows[0].id;

    console.log(`✅ Order ${orderId} executed: ${order.side} ${order.quantity} ${order.symbol} at ${fillPrice}`);
    console.log(`✅ Trade created: ${tradeId}`);

    await client.query('COMMIT');

    res.json({
      success: true,
      order_id: parseInt(orderId),
      trade_id: tradeId,
      status: 'filled',
      symbol: order.symbol,
      side: order.side,
      fill_price: fillPrice,
      quantity: parseFloat(order.quantity),
      notional: notional
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Execute order error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Cancel order
app.patch('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.headers['x-user-id']; // User ID from API Gateway

    // Security: Verify user ID is present
    if (!userId) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Update order only if user owns it (via portfolio)
    const result = await pool.query(
      `UPDATE orders o
       SET status = 'canceled', updated_ts = NOW()
       FROM portfolios p
       WHERE o.id = $1 AND o.status IN ('new', 'open')
         AND o.portfolio_id = p.id AND p.user_id = $2
       RETURNING o.*`,
      [orderId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found, cannot be canceled, or access denied' });
    }

    res.json({
      success: true,
      order: result.rows[0]
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Order Service running on port ${PORT}`);
  });
}

module.exports = app;
