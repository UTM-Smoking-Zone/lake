-- Analytics Service Views
-- These views provide OHLCV data with symbol VARCHAR (not symbol_id)
-- Compatible with analytics-service expectations

-- View: v_ohlcv_1m (1 minute candles)
CREATE OR REPLACE VIEW public.v_ohlcv_1m AS
SELECT
    s.symbol AS symbol,
    o.open_ts AS open_time,
    o.open,
    o.high,
    o.low,
    o.close,
    o.volume,
    o.open_ts + INTERVAL '1 minute' AS close_time,
    1 AS trades_count  -- Placeholder, actual trade count not available
FROM public.ohlcv_1m o
JOIN public.symbols s ON o.symbol_id = s.id;

-- View: v_ohlcv_5m (5 minute candles)
CREATE OR REPLACE VIEW public.v_ohlcv_5m AS
WITH buckets AS (
    SELECT
        symbol_id,
        exchange_id,
        open_ts,
        open,
        high,
        low,
        close,
        volume,
        date_trunc('minute', open_ts) -
        ((EXTRACT(minute FROM open_ts)::integer % 5)::double precision * interval '1 minute') AS bucket_ts
    FROM public.ohlcv_1m
)
SELECT
    s.symbol AS symbol,
    bucket_ts AS open_time,
    (array_agg(open ORDER BY open_ts))[1] AS open,
    max(high) AS high,
    min(low) AS low,
    (array_agg(close ORDER BY open_ts DESC))[1] AS close,
    sum(volume) AS volume,
    bucket_ts + INTERVAL '5 minutes' AS close_time,
    count(*) AS trades_count
FROM buckets b
JOIN public.symbols s ON b.symbol_id = s.id
GROUP BY s.symbol, bucket_ts;

-- View: v_ohlcv_15m (15 minute candles)
CREATE OR REPLACE VIEW public.v_ohlcv_15m AS
WITH buckets AS (
    SELECT
        symbol_id,
        exchange_id,
        open_ts,
        open,
        high,
        low,
        close,
        volume,
        date_trunc('minute', open_ts) -
        ((EXTRACT(minute FROM open_ts)::integer % 15)::double precision * interval '1 minute') AS bucket_ts
    FROM public.ohlcv_1m
)
SELECT
    s.symbol AS symbol,
    bucket_ts AS open_time,
    (array_agg(open ORDER BY open_ts))[1] AS open,
    max(high) AS high,
    min(low) AS low,
    (array_agg(close ORDER BY open_ts DESC))[1] AS close,
    sum(volume) AS volume,
    bucket_ts + INTERVAL '15 minutes' AS close_time,
    count(*) AS trades_count
FROM buckets b
JOIN public.symbols s ON b.symbol_id = s.id
GROUP BY s.symbol, bucket_ts;

-- View: v_ohlcv_1h (1 hour candles)
CREATE OR REPLACE VIEW public.v_ohlcv_1h AS
WITH buckets AS (
    SELECT
        symbol_id,
        exchange_id,
        open_ts,
        open,
        high,
        low,
        close,
        volume,
        date_trunc('hour', open_ts) AS bucket_ts
    FROM public.ohlcv_1m
)
SELECT
    s.symbol AS symbol,
    bucket_ts AS open_time,
    (array_agg(open ORDER BY open_ts))[1] AS open,
    max(high) AS high,
    min(low) AS low,
    (array_agg(close ORDER BY open_ts DESC))[1] AS close,
    sum(volume) AS volume,
    bucket_ts + INTERVAL '1 hour' AS close_time,
    count(*) AS trades_count
FROM buckets b
JOIN public.symbols s ON b.symbol_id = s.id
GROUP BY s.symbol, bucket_ts;

-- Grant permissions
GRANT SELECT ON public.v_ohlcv_1m TO PUBLIC;
GRANT SELECT ON public.v_ohlcv_5m TO PUBLIC;
GRANT SELECT ON public.v_ohlcv_15m TO PUBLIC;
GRANT SELECT ON public.v_ohlcv_1h TO PUBLIC;

-- Insert sample OHLCV data for testing (if table is empty)
-- This ensures analytics service has data to work with
INSERT INTO public.ohlcv_1m (symbol_id, exchange_id, open_ts, open, high, low, close, volume)
SELECT
    s.id AS symbol_id,
    e.id AS exchange_id,
    NOW() - (interval '1 minute' * generate_series),
    50000 + random() * 1000 AS open,
    50500 + random() * 1000 AS high,
    49500 + random() * 1000 AS low,
    50000 + random() * 1000 AS close,
    random() * 100 AS volume
FROM generate_series(0, 200) AS generate_series
CROSS JOIN (SELECT id FROM public.symbols WHERE symbol = 'BTCUSDT' LIMIT 1) s
CROSS JOIN (SELECT id FROM public.exchanges WHERE code = 'BINANCE' LIMIT 1) e
ON CONFLICT (symbol_id, exchange_id, open_ts) DO NOTHING;

COMMENT ON VIEW public.v_ohlcv_1m IS 'Analytics Service view: 1-minute OHLCV data with symbol as VARCHAR';
COMMENT ON VIEW public.v_ohlcv_5m IS 'Analytics Service view: 5-minute aggregated OHLCV data';
COMMENT ON VIEW public.v_ohlcv_15m IS 'Analytics Service view: 15-minute aggregated OHLCV data';
COMMENT ON VIEW public.v_ohlcv_1h IS 'Analytics Service view: 1-hour aggregated OHLCV data';
