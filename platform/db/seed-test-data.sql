-- Seed test data for trading platform

-- Insert test user
INSERT INTO users (email, display_name, password_hash)
VALUES ('test@example.com', 'Test User', 'password123')
ON CONFLICT (email) DO NOTHING;

-- Get user_id
DO $$
DECLARE
    v_user_id bigint;
    v_btc_id bigint;
    v_eth_id bigint;
    v_usdt_id bigint;
    v_btcusdt_id bigint;
    v_ethusdt_id bigint;
    v_binance_id bigint;
    v_portfolio_id bigint;
BEGIN
    -- Get IDs
    SELECT id INTO v_user_id FROM users WHERE email = 'test@example.com';
    SELECT id INTO v_btc_id FROM assets WHERE code = 'BTC';
    SELECT id INTO v_eth_id FROM assets WHERE code = 'ETH';
    SELECT id INTO v_usdt_id FROM assets WHERE code = 'USDT';
    SELECT id INTO v_binance_id FROM exchanges WHERE code = 'BINANCE';

    -- Insert BTCUSDT symbol if not exists
    INSERT INTO symbols (symbol, base_asset_id, quote_asset_id)
    VALUES ('BTCUSDT', v_btc_id, v_usdt_id)
    ON CONFLICT (symbol) DO NOTHING;

    -- Insert ETHUSDT symbol if not exists
    INSERT INTO symbols (symbol, base_asset_id, quote_asset_id)
    VALUES ('ETHUSDT', v_eth_id, v_usdt_id)
    ON CONFLICT (symbol) DO NOTHING;

    SELECT id INTO v_btcusdt_id FROM symbols WHERE symbol = 'BTCUSDT';
    SELECT id INTO v_ethusdt_id FROM symbols WHERE symbol = 'ETHUSDT';

    -- Create portfolio for test user
    INSERT INTO portfolios (user_id, name, base_currency_id)
    VALUES (v_user_id, 'Test Portfolio', v_usdt_id)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_portfolio_id;

    -- If portfolio already exists, get its ID
    IF v_portfolio_id IS NULL THEN
        SELECT id INTO v_portfolio_id FROM portfolios WHERE user_id = v_user_id LIMIT 1;
    END IF;

    -- Add initial balances
    INSERT INTO balances (portfolio_id, asset_id, qty)
    VALUES
        (v_portfolio_id, v_usdt_id, 10000.00),
        (v_portfolio_id, v_btc_id, 0.1),
        (v_portfolio_id, v_eth_id, 2.0)
    ON CONFLICT (portfolio_id, asset_id)
    DO UPDATE SET qty = EXCLUDED.qty;

    -- Add test orders
    INSERT INTO orders (portfolio_id, symbol_id, exchange_id, side, type, price, quantity, status, created_ts)
    VALUES
        (v_portfolio_id, v_btcusdt_id, v_binance_id, 'buy', 'limit', 89000.00, 0.05, 'filled', NOW() - INTERVAL '2 hours'),
        (v_portfolio_id, v_btcusdt_id, v_binance_id, 'buy', 'limit', 88500.00, 0.05, 'filled', NOW() - INTERVAL '1 hour'),
        (v_portfolio_id, v_btcusdt_id, v_binance_id, 'sell', 'limit', 90000.00, 0.03, 'open', NOW() - INTERVAL '30 minutes'),
        (v_portfolio_id, v_ethusdt_id, v_binance_id, 'buy', 'market', 3200.00, 1.0, 'filled', NOW() - INTERVAL '3 hours')
    ON CONFLICT DO NOTHING;

    -- Add test positions
    INSERT INTO positions (portfolio_id, symbol_id, qty, avg_price)
    VALUES
        (v_portfolio_id, v_btcusdt_id, 0.1, 88750.00),
        (v_portfolio_id, v_ethusdt_id, 2.0, 3200.00)
    ON CONFLICT (portfolio_id, symbol_id)
    DO UPDATE SET qty = EXCLUDED.qty, avg_price = EXCLUDED.avg_price;

    -- Add test trades
    INSERT INTO trades (portfolio_id, symbol_id, exchange_id, external_trade_id, side, price, quantity, fee_asset_id, fee_amount, trade_ts)
    VALUES
        (v_portfolio_id, v_btcusdt_id, v_binance_id, 'test_trade_1', 'buy', 89000.00, 0.05, v_usdt_id, 4.45, NOW() - INTERVAL '2 hours'),
        (v_portfolio_id, v_btcusdt_id, v_binance_id, 'test_trade_2', 'buy', 88500.00, 0.05, v_usdt_id, 4.425, NOW() - INTERVAL '1 hour'),
        (v_portfolio_id, v_ethusdt_id, v_binance_id, 'test_trade_3', 'buy', 3200.00, 1.0, v_usdt_id, 3.2, NOW() - INTERVAL '3 hours'),
        (v_portfolio_id, v_ethusdt_id, v_binance_id, 'test_trade_4', 'buy', 3210.00, 1.0, v_usdt_id, 3.21, NOW() - INTERVAL '4 hours')
    ON CONFLICT DO NOTHING;

    -- Add OHLCV test data for BTCUSDT (1-minute intervals)
    INSERT INTO ohlcv_1m (symbol_id, exchange_id, open_ts, open, high, low, close, volume)
    SELECT
        v_btcusdt_id,
        v_binance_id,
        ts,
        88000 + (random() * 2000)::numeric(20,8),
        89000 + (random() * 2000)::numeric(20,8),
        87000 + (random() * 2000)::numeric(20,8),
        88500 + (random() * 2000)::numeric(20,8),
        (100 + random() * 50)::numeric(38,18)
    FROM generate_series(
        NOW() - INTERVAL '6 hours',
        NOW(),
        INTERVAL '1 minute'
    ) AS ts
    ON CONFLICT (symbol_id, exchange_id, open_ts) DO NOTHING;

    -- Add OHLCV test data for ETHUSDT (1-minute intervals)
    INSERT INTO ohlcv_1m (symbol_id, exchange_id, open_ts, open, high, low, close, volume)
    SELECT
        v_ethusdt_id,
        v_binance_id,
        ts,
        3100 + (random() * 200)::numeric(20,8),
        3200 + (random() * 200)::numeric(20,8),
        3000 + (random() * 200)::numeric(20,8),
        3150 + (random() * 200)::numeric(20,8),
        (1000 + random() * 500)::numeric(38,18)
    FROM generate_series(
        NOW() - INTERVAL '6 hours',
        NOW(),
        INTERVAL '1 minute'
    ) AS ts
    ON CONFLICT (symbol_id, exchange_id, open_ts) DO NOTHING;

    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW ohlcv_5m;

    RAISE NOTICE 'Test data seeded successfully for user_id: %, portfolio_id: %', v_user_id, v_portfolio_id;
END $$;
