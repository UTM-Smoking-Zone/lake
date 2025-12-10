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
            'trades': []
        })

        # Symbol and exchange caches
        self.symbol_cache = {}
        self.exchange_cache = {}

        # Connect to PostgreSQL
        self._connect()

        # Load symbol and exchange mappings
        self._load_symbol_cache()
        self._load_exchange_cache()

        print("✅ PostgreSQL writer initialized")

    def _connect(self):
        """Establish PostgreSQL connection"""
        try:
            self.conn = psycopg2.connect(
                host=os.getenv('POSTGRES_HOST', 'postgres'),
                port=int(os.getenv('POSTGRES_PORT', 5432)),
                database=os.getenv('POSTGRES_DB', 'lakehouse'),
                user=os.getenv('POSTGRES_USER', 'admin'),
                password=os.getenv('POSTGRES_PASSWORD', 'admin123')
            )
            self.cursor = self.conn.cursor()
            print("✅ Connected to PostgreSQL successfully")
        except Exception as e:
            print(f"❌ Failed to connect to PostgreSQL: {e}")
            raise

    def _load_symbol_cache(self):
        """Load symbol_id mappings from database"""
        try:
            self.cursor.execute("SELECT id, symbol FROM symbols")
            for row in self.cursor.fetchall():
                self.symbol_cache[row[1]] = row[0]
            print(f"📋 Loaded {len(self.symbol_cache)} symbols into cache")
        except Exception as e:
            print(f"⚠️ Error loading symbol cache: {e}")

    def _load_exchange_cache(self):
        """Load exchange_id mappings from database"""
        try:
            self.cursor.execute("SELECT id, code FROM exchanges")
            for row in self.cursor.fetchall():
                self.exchange_cache[row[1]] = row[0]
            print(f"📋 Loaded {len(self.exchange_cache)} exchanges into cache")
        except Exception as e:
            print(f"⚠️ Error loading exchange cache: {e}")

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
            source = trade.get('source', 'bybit').upper()

            # Round timestamp to minute boundary
            if isinstance(timestamp, datetime):
                minute_ts = timestamp.replace(second=0, microsecond=0, tzinfo=timezone.utc)
            else:
                return

            # Create candle key (symbol, exchange, minute_timestamp)
            candle_key = (symbol, source, minute_ts)
            candle = self.candles[candle_key]

            # Update OHLC
            if candle['open'] is None:
                candle['open'] = price
            candle['high'] = max(candle['high'], price) if candle['high'] else price
            candle['low'] = min(candle['low'], price) if candle['low'] else price
            candle['close'] = price
            candle['volume'] += volume

        except Exception as e:
            print(f"⚠️ Error adding trade to candle: {e}")

    def flush_candles(self, force_all=False):
        """
        Write completed candles to PostgreSQL.
        If force_all=False, only writes candles older than 1 minute (completed).
        If force_all=True, writes all candles (used on shutdown).
        """
        if not self.candles:
            return

        current_time = datetime.now(timezone.utc).replace(second=0, microsecond=0)
        candles_to_write = []
        keys_to_remove = []

        for candle_key, candle_data in self.candles.items():
            symbol, exchange_code, minute_ts = candle_key

            # Only write completed candles (older than current minute)
            if not force_all and minute_ts >= current_time:
                continue

            # Get symbol_id
            symbol_id = self.symbol_cache.get(symbol)
            if symbol_id is None:
                print(f"⚠️ Symbol {symbol} not found in cache, skipping")
                keys_to_remove.append(candle_key)
                continue

            # Map source to exchange (bybit -> BINANCE for now, as we don't have bybit in DB)
            # TODO: Add proper exchange mapping or create BYBIT exchange in DB
            if exchange_code == 'BYBIT':
                exchange_code = 'BINANCE'  # Temporary mapping

            exchange_id = self.exchange_cache.get(exchange_code)
            if exchange_id is None:
                print(f"⚠️ Exchange {exchange_code} not found in cache, skipping")
                keys_to_remove.append(candle_key)
                continue

            # Prepare candle data
            candles_to_write.append((
                symbol_id,
                exchange_id,
                minute_ts,
                candle_data['open'],
                candle_data['high'],
                candle_data['low'],
                candle_data['close'],
                candle_data['volume']
            ))

            keys_to_remove.append(candle_key)

        # Write candles to database
        if candles_to_write:
            self._write_candles_batch(candles_to_write)

        # Remove processed candles
        for key in keys_to_remove:
            del self.candles[key]

    def _write_candles_batch(self, candles: List[tuple]):
        """Write batch of candles to PostgreSQL"""
        try:
            # Use INSERT ... ON CONFLICT DO UPDATE to handle duplicates
            insert_query = """
                INSERT INTO ohlcv_1m (symbol_id, exchange_id, open_ts, open, high, low, close, volume)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (symbol_id, exchange_id, open_ts)
                DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume
            """

            execute_batch(self.cursor, insert_query, candles)
            self.conn.commit()

            print(f"💾 Wrote {len(candles)} candles to PostgreSQL ohlcv_1m")

        except Exception as e:
            print(f"❌ Error writing candles to PostgreSQL: {e}")
            self.conn.rollback()

            # Try to reconnect if connection was lost
            try:
                if self.conn.closed:
                    print("🔄 Reconnecting to PostgreSQL...")
                    self._connect()
                    self._load_symbol_cache()
                    self._load_exchange_cache()
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
