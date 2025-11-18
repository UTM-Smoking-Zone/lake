-- Create schemas for different purposes
CREATE SCHEMA IF NOT EXISTS iceberg_catalog;
CREATE SCHEMA IF NOT EXISTS airflow;
CREATE SCHEMA IF NOT EXISTS trading;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA iceberg_catalog TO admin;
GRANT ALL PRIVILEGES ON SCHEMA airflow TO admin;
GRANT ALL PRIVILEGES ON SCHEMA trading TO admin;

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MICROSERVICES DATABASE SCHEMA
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Portfolios (demo wallets)
CREATE TABLE IF NOT EXISTS portfolios (
    portfolio_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) DEFAULT 'demo' CHECK (type IN ('demo', 'live')),
    balance DECIMAL(20, 8) DEFAULT 0,
    initial_balance DECIMAL(20, 8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Holdings (assets in portfolio)
CREATE TABLE IF NOT EXISTS holdings (
    holding_id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    quantity DECIMAL(20, 8) DEFAULT 0,
    avg_price DECIMAL(20, 8) DEFAULT 0,
    current_value DECIMAL(20, 8) DEFAULT 0,
    pnl DECIMAL(20, 8) DEFAULT 0,
    pnl_percent DECIMAL(10, 4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, symbol)
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    order_id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) CHECK (side IN ('buy', 'sell')),
    type VARCHAR(10) CHECK (type IN ('market', 'limit')),
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'cancelled', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    filled_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions (audit trail)
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES portfolios(portfolio_id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(order_id) ON DELETE SET NULL,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) CHECK (side IN ('buy', 'sell')),
    quantity DECIMAL(20, 8) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    total DECIMAL(20, 8) NOT NULL,
    fee DECIMAL(20, 8) DEFAULT 0,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id ON holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_orders_portfolio_id ON orders(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_transactions_portfolio_id ON transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);

-- Insert demo user and portfolio for testing
INSERT INTO users (username, email, full_name) 
VALUES ('demo_user', 'demo@trading.com', 'Demo User')
ON CONFLICT (username) DO NOTHING;

INSERT INTO portfolios (user_id, name, type, balance, initial_balance)
SELECT user_id, 'Demo Wallet', 'demo', 10000.00, 10000.00
FROM users WHERE username = 'demo_user'
ON CONFLICT DO NOTHING;

-- Log successful initialization
SELECT 'Database initialized successfully with microservices schema' AS status;