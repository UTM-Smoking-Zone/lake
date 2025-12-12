-- Order Service Database Schema
-- Isolated database for order execution and management

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- Custom Types
CREATE TYPE order_status AS ENUM (
    'pending',
    'open',
    'partially_filled',
    'filled',
    'canceled',
    'rejected',
    'expired'
);

CREATE TYPE order_type AS ENUM (
    'market',
    'limit',
    'stop_loss',
    'stop_limit'
);

CREATE TYPE trade_side AS ENUM (
    'buy',
    'sell'
);

-- Orders Table (portfolio_id and user_id are external references)
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL, -- External reference to user-service
    portfolio_id BIGINT NOT NULL, -- External reference to portfolio-service
    symbol VARCHAR(32) NOT NULL,
    side trade_side NOT NULL,
    type order_type NOT NULL,
    price NUMERIC(20,8),
    quantity NUMERIC(38,18) NOT NULL,
    filled_quantity NUMERIC(38,18) DEFAULT 0 NOT NULL,
    status order_status DEFAULT 'pending' NOT NULL,
    exchange VARCHAR(32) DEFAULT 'binance',
    external_order_id VARCHAR(64),
    client_order_id VARCHAR(64) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    executed_at TIMESTAMPTZ,
    metadata JSONB,
    CONSTRAINT chk_orders_quantity_pos CHECK (quantity > 0),
    CONSTRAINT chk_orders_filled CHECK (filled_quantity <= quantity),
    CONSTRAINT chk_orders_price CHECK (type = 'market' OR price > 0)
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_portfolio_id ON orders(portfolio_id);
CREATE INDEX idx_orders_symbol ON orders(symbol);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Order Events Table (for event sourcing)
CREATE TABLE IF NOT EXISTS order_events (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    event_type VARCHAR(50) NOT NULL, -- 'order.created', 'order.filled', 'order.canceled'
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_order_events_order_id ON order_events(order_id);
CREATE INDEX idx_order_events_type ON order_events(event_type);

-- Function to publish order events to Kafka (placeholder)
CREATE OR REPLACE FUNCTION notify_order_event()
RETURNS TRIGGER AS $$
BEGIN
    -- This would be replaced with actual Kafka producer logic
    -- For now, just log the event
    RAISE NOTICE 'Order Event: % for order %', NEW.event_type, NEW.order_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_events_notify
AFTER INSERT ON order_events
FOR EACH ROW
EXECUTE FUNCTION notify_order_event();
