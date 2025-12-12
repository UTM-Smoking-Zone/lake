import psycopg2
from psycopg2.extras import execute_batch
from datetime import datetime, timezone
from typing import Dict, List
from collections import defaultdict
import os
import time


class PostgresWriter:
    """
    Writes real-time OHLCV candle data to PostgreSQL.
    Aggregates trade records into 1-minute candles and persists to ohlcv_1m table.
    """

    def __init__(self):
        self.conn = None
        self.cursor = None
        self.candles = defaultdict(lambda: {
            'open': None,
            'high': None,
            'low': None,
            'close': None,
            'volume': 0.0,
            'trades_count': 0
        })

        # Connect to PostgreSQL (analytics_service database)
        self._connect()

        print("✅ PostgreSQL writer initialized (analytics_service)")

    def _connect(self):
        """Establish PostgreSQL connection to analytics_service database"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv('POSTGRES_HOST', 'postgres-analytics'),
                port=int(os.getenv('POSTGRES_PORT', 5432)),
                database=os.getenv('POSTGRES_DB', 'analytics_service'),
                user=os.getenv('POSTGRES_USER', 'admin'),
                password=os.getenv('POSTGRES_PASSWORD', 'admin123')
            )
            self.cursor = self.conn.cursor()
            print("✅ Connected to PostgreSQL analytics_service successfully")
        except Exception as e:
            print(f"❌ Failed to connect to PostgreSQL: {e}")
            raise

    def add_trade(self, trade: Dict):
        """
        Add trade to candle aggregation.
        Expects trade format: {symbol, timestamp, price, volume, source}
        """
        try:
            symbol = trade.get('symbol', 'BTCUSDT')
            timestamp = trade.get('timestamp')
            price = float(trade.get('price', 0))
            volume = float(trade.get('volume', 0))

            # Round timestamp to minute boundary
            if isinstance(timestamp, datetime):
                minute_ts = timestamp.replace(second=0, microsecond=0, tzinfo=timezone.utc)
            else:
                return

            # Create candle key (symbol, minute_timestamp) - no exchange separation
            candle_key = (symbol, minute_ts)
            candle = self.candles[candle_key]

            # Update OHLC
            if candle['open'] is None:
                candle['open'] = price
            candle['high'] = max(candle['high'], price) if candle['high'] else price
            candle['low'] = min(candle['low'], price) if candle['low'] else price
            candle['close'] = price
            candle['volume'] += volume
            candle['trades_count'] += 1

        except Exception as e:
            print(f"⚠️ Error adding trade to candle: {e}")

    def flush_candles(self, force_all=False):
        """
        Write completed candles to PostgreSQL analytics_service.
        If force_all=False, only writes candles older than 1 minute (completed).
        If force_all=True, writes all candles (used on shutdown).
        """
        if not self.candles:
            return

        current_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        candles_to_write = []
        keys_to_remove = []

        for candle_key, candle_data in self.candles.items():
            symbol, minute_ts = candle_key

            # Only write completed candles (older than current minute)
            if not force_all and minute_ts >= current_time:
                continue

            # Calculate close_time (1 minute after open_time)
            close_time = minute_ts.replace(second=59, microsecond=999999)

            # Prepare candle data for ohlcv_1m table (new schema)
            candles_to_write.append((
                symbol,
                minute_ts,
                candle_data['open'],
                candle_data['high'],
                candle_data['low'],
                candle_data['close'],
                candle_data['volume'],
                close_time,
                candle_data['trades_count']
            ))

            keys_to_remove.append(candle_key)

        # Write candles to database
        if candles_to_write:
            self._write_candles_batch(candles_to_write)

        # Remove processed candles
        for key in keys_to_remove:
            del self.candles[key]

    def _write_candles_batch(self, candles: List[tuple]):
        """Write batch of candles to PostgreSQL analytics_service ohlcv_1m"""
        try:
            # Use INSERT ... ON CONFLICT DO UPDATE to handle duplicates
            insert_query = """
                INSERT INTO ohlcv_1m (symbol, open_time, open, high, low, close, volume, close_time, trades_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (symbol, open_time)
                DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume,
                    close_time = EXCLUDED.close_time,
                    trades_count = EXCLUDED.trades_count
            """

            execute_batch(self.cursor, insert_query, candles)
            self.conn.commit()

            print(f"💾 Wrote {len(candles)} candles to analytics_service.ohlcv_1m")

        except Exception as e:
            print(f"❌ Error writing candles to PostgreSQL: {e}")
            self.conn.rollback()

            # Try to reconnect if connection was lost
            try:
                if self.conn.closed:
                    print("🔄 Reconnecting to PostgreSQL analytics_service...")
                    self._connect()
            except Exception as reconnect_error:
                print(f"❌ Failed to reconnect: {reconnect_error}")

    def close(self):
        """Flush remaining candles and close connection"""
        print("🛑 Flushing remaining candles before shutdown...")
        self.flush_candles(force_all=True)

        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()

        print("✅ PostgreSQL writer closed")
