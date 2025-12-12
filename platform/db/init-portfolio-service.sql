-- Portfolio Service Database Schema
-- Isolated database for portfolio and balance management

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Assets Table (reference data)
CREATE TABLE IF NOT EXISTS assets (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(64) NOT NULL
);

-- Portfolios Table (user_id is external reference, no FK)
CREATE TABLE IF NOT EXISTS portfolios (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL, -- External reference to user-service
    name VARCHAR(100) NOT NULL,
    base_currency_code VARCHAR(32) DEFAULT 'USDT' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);

-- Balances Table
CREATE TABLE IF NOT EXISTS balances (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    asset_id BIGINT NOT NULL REFERENCES assets(id),
    qty NUMERIC(38,18) DEFAULT 0 NOT NULL,
    locked_qty NUMERIC(38,18) DEFAULT 0 NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT chk_balances_qty CHECK (qty >= 0),
    CONSTRAINT chk_balances_locked CHECK (locked_qty >= 0),
    CONSTRAINT uq_balances UNIQUE (portfolio_id, asset_id)
);

CREATE INDEX idx_balances_portfolio ON balances(portfolio_id);

-- Portfolio Events Table (for event sourcing)
CREATE TABLE IF NOT EXISTS portfolio_events (
    id BIGSERIAL PRIMARY KEY,
    portfolio_id BIGINT NOT NULL REFERENCES portfolios(id),
    event_type VARCHAR(50) NOT NULL, -- 'portfolio.created', 'balance.updated'
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_portfolio_events_portfolio_id ON portfolio_events(portfolio_id);

-- Insert default assets
INSERT INTO assets (code, name) VALUES
('BTC', 'Bitcoin'),
('ETH', 'Ethereum'),
('USDT', 'Tether USD'),
('USDC', 'USD Coin'),
('BNB', 'Binance Coin')
ON CONFLICT (code) DO NOTHING;
