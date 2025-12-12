-- Analytics Service Database Schema
-- Read-only replica for OHLCV data from Kafka Consumer

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

-- OHLCV 1-minute candles (materialized view from Kafka stream)
CREATE TABLE IF NOT EXISTS ohlcv_1m (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(32) NOT NULL,
    open_time TIMESTAMPTZ NOT NULL,
    open NUMERIC(20,8) NOT NULL,
    high NUMERIC(20,8) NOT NULL,
    low NUMERIC(20,8) NOT NULL,
    close NUMERIC(20,8) NOT NULL,
    volume NUMERIC(38,18) NOT NULL,
    close_time TIMESTAMPTZ NOT NULL,
    trades_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_ohlcv_1m UNIQUE (symbol, open_time)
);

CREATE INDEX idx_ohlcv_1m_symbol ON ohlcv_1m(symbol);
CREATE INDEX idx_ohlcv_1m_open_time ON ohlcv_1m(open_time DESC);

-- Materialized view for 5m candles
CREATE MATERIALIZED VIEW ohlcv_5m AS
SELECT
    symbol,
    date_trunc('hour', open_time) +
        interval '5 min' * floor(date_part('minute', open_time) / 5) as open_time,
    (array_agg(open ORDER BY open_time ASC))[1] as open,
    MAX(high) as high,
    MIN(low) as low,
    (array_agg(close ORDER BY open_time DESC))[1] as close,
    SUM(volume) as volume,
    SUM(trades_count) as trades_count,
    COUNT(*) as candles_count
FROM ohlcv_1m
GROUP BY symbol, date_trunc('hour', open_time) +
    interval '5 min' * floor(date_part('minute', open_time) / 5);

CREATE UNIQUE INDEX idx_ohlcv_5m_symbol_time ON ohlcv_5m(symbol, open_time);

-- Materialized view for 15m candles
CREATE MATERIALIZED VIEW ohlcv_15m AS
SELECT
    symbol,
    date_trunc('hour', open_time) +
        interval '15 min' * floor(date_part('minute', open_time) / 15) as open_time,
    (array_agg(open ORDER BY open_time ASC))[1] as open,
    MAX(high) as high,
    MIN(low) as low,
    (array_agg(close ORDER BY open_time DESC))[1] as close,
    SUM(volume) as volume,
    SUM(trades_count) as trades_count,
    COUNT(*) as candles_count
FROM ohlcv_1m
GROUP BY symbol, date_trunc('hour', open_time) +
    interval '15 min' * floor(date_part('minute', open_time) / 15);

CREATE UNIQUE INDEX idx_ohlcv_15m_symbol_time ON ohlcv_15m(symbol, open_time);

-- Materialized view for 1h candles
CREATE MATERIALIZED VIEW ohlcv_1h AS
SELECT
    symbol,
    date_trunc('hour', open_time) as open_time,
    (array_agg(open ORDER BY open_time ASC))[1] as open,
    MAX(high) as high,
    MIN(low) as low,
    (array_agg(close ORDER BY open_time DESC))[1] as close,
    SUM(volume) as volume,
    SUM(trades_count) as trades_count,
    COUNT(*) as candles_count
FROM ohlcv_1m
GROUP BY symbol, date_trunc('hour', open_time);

CREATE UNIQUE INDEX idx_ohlcv_1h_symbol_time ON ohlcv_1h(symbol, open_time);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_ohlcv_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY ohlcv_5m;
    REFRESH MATERIALIZED VIEW CONCURRENTLY ohlcv_15m;
    REFRESH MATERIALIZED VIEW CONCURRENTLY ohlcv_1h;
END;
$$ LANGUAGE plpgsql;
