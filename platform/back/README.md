# API (NestJS)

- `GET /candles?symbol=BTCUSDT&interval=1m&limit=500`
- Socket.IO namespace `/market`, emits `kline` events (normalized candle ticks).
