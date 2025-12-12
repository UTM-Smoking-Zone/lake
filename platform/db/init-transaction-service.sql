-- Transaction Service Database Schema
-- Isolated database for transaction history and audit trail

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Custom Types
CREATE TYPE transaction_type AS ENUM (
    'trade',
    'deposit',
    'withdrawal',
    'fee',
    'transfer'
);

CREATE TYPE transaction_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'reversed'
);

-- Transactions Table (Partitioned by month)
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL,
    user_id BIGINT NOT NULL, -- External reference to user-service
    portfolio_id BIGINT NOT NULL, -- External reference to portfolio-service
    order_id BIGINT, -- External reference to order-service (nullable)
    type transaction_type NOT NULL,
    status transaction_status DEFAULT 'pending' NOT NULL,
    symbol VARCHAR(32),
    asset_code VARCHAR(32) NOT NULL,
    amount NUMERIC(38,18) NOT NULL,
    price NUMERIC(20,8),
    fee_amount NUMERIC(38,18) DEFAULT 0,
    fee_asset VARCHAR(32),
    exchange VARCHAR(32) DEFAULT 'binance',
    external_transaction_id VARCHAR(64),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    metadata JSONB,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for 2024-2025
CREATE TABLE transactions_2024_12 PARTITION OF transactions
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE transactions_2025_01 PARTITION OF transactions
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE transactions_2025_02 PARTITION OF transactions
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE transactions_2025_03 PARTITION OF transactions
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE transactions_2025_04 PARTITION OF transactions
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE transactions_2025_05 PARTITION OF transactions
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE transactions_2025_06 PARTITION OF transactions
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE transactions_2025_07 PARTITION OF transactions
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE transactions_2025_08 PARTITION OF transactions
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE transactions_2025_09 PARTITION OF transactions
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE transactions_2025_10 PARTITION OF transactions
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE transactions_2025_11 PARTITION OF transactions
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE transactions_2025_12 PARTITION OF transactions
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Indexes
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_portfolio_id ON transactions(portfolio_id);
CREATE INDEX idx_transactions_order_id ON transactions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

-- Transaction Events (for audit trail)
CREATE TABLE IF NOT EXISTS transaction_events (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'transaction.created', 'transaction.completed'
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_transaction_events_transaction_id ON transaction_events(transaction_id);
