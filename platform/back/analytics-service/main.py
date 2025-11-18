"""
Analytics Service - Real-time analytics and technical indicators
Calculates: OHLCV, SMA, EMA, RSI, MACD, etc.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import pandas as pd
import numpy as np
import redis
import json
import os
from datetime import datetime, timedelta

app = FastAPI(title="Analytics Service", version="1.0.0")

# Redis for caching
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True
)

# Routes
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "analytics-service"}

@app.get("/ohlcv")
async def get_ohlcv(symbol: str, interval: str = "1m", limit: int = 100):
    """
    Get OHLCV data for symbol
    Intervals: 1m, 5m, 15m, 1h, 4h, 1d
    """
    try:
        # Check Redis cache first
        cache_key = f"ohlcv:{symbol}:{interval}"
        cached = redis_client.get(cache_key)
        
        if cached:
            return json.loads(cached)
        
        # In production, query from Iceberg/DuckDB
        # For now, return sample data
        ohlcv = generate_sample_ohlcv(symbol, interval, limit)
        
        # Cache for 1 minute
        redis_client.setex(cache_key, 60, json.dumps(ohlcv))
        
        return ohlcv
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/indicators")
async def get_indicators(symbol: str, indicators: str):
    """
    Get technical indicators
    indicators: comma-separated list (sma,ema,rsi,macd)
    """
    try:
        # Get OHLCV data
        ohlcv_data = await get_ohlcv(symbol, "1m", 200)
        df = pd.DataFrame(ohlcv_data['data'])
        
        result = {}
        indicator_list = indicators.lower().split(',')
        
        if 'sma' in indicator_list:
            result['sma_20'] = calculate_sma(df['close'], 20)
            result['sma_50'] = calculate_sma(df['close'], 50)
        
        if 'ema' in indicator_list:
            result['ema_12'] = calculate_ema(df['close'], 12)
            result['ema_26'] = calculate_ema(df['close'], 26)
        
        if 'rsi' in indicator_list:
            result['rsi'] = calculate_rsi(df['close'], 14)
        
        if 'macd' in indicator_list:
            macd_data = calculate_macd(df['close'])
            result['macd'] = macd_data
        
        return {
            "symbol": symbol,
            "indicators": result,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/latest-price")
async def get_latest_price(symbol: str):
    """Get latest price from Redis"""
    try:
        price = redis_client.get(f"price:{symbol}")
        if not price:
            raise HTTPException(status_code=404, detail="Price not available")
        
        return {
            "symbol": symbol,
            "price": float(price),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions for indicators

def calculate_sma(prices: pd.Series, period: int) -> List[float]:
    """Simple Moving Average"""
    sma = prices.rolling(window=period).mean()
    return sma.dropna().tolist()

def calculate_ema(prices: pd.Series, period: int) -> List[float]:
    """Exponential Moving Average"""
    ema = prices.ewm(span=period, adjust=False).mean()
    return ema.dropna().tolist()

def calculate_rsi(prices: pd.Series, period: int = 14) -> List[float]:
    """Relative Strength Index"""
    delta = prices.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    
    return rsi.dropna().tolist()

def calculate_macd(prices: pd.Series):
    """Moving Average Convergence Divergence"""
    ema_12 = prices.ewm(span=12, adjust=False).mean()
    ema_26 = prices.ewm(span=26, adjust=False).mean()
    
    macd_line = ema_12 - ema_26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    histogram = macd_line - signal_line
    
    return {
        "macd": macd_line.dropna().tolist(),
        "signal": signal_line.dropna().tolist(),
        "histogram": histogram.dropna().tolist()
    }

def generate_sample_ohlcv(symbol: str, interval: str, limit: int):
    """Generate sample OHLCV data (replace with real data from Iceberg)"""
    now = datetime.utcnow()
    interval_minutes = {
        "1m": 1, "5m": 5, "15m": 15, "1h": 60, "4h": 240, "1d": 1440
    }
    
    minutes = interval_minutes.get(interval, 1)
    base_price = 50000.0  # Sample BTC price
    
    data = []
    for i in range(limit):
        timestamp = now - timedelta(minutes=minutes * (limit - i))
        
        # Random walk for demo
        open_price = base_price + np.random.uniform(-100, 100)
        high_price = open_price + np.random.uniform(0, 50)
        low_price = open_price - np.random.uniform(0, 50)
        close_price = np.random.uniform(low_price, high_price)
        volume = np.random.uniform(10, 100)
        
        data.append({
            "timestamp": timestamp.isoformat(),
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "close": round(close_price, 2),
            "volume": round(volume, 4)
        })
        
        base_price = close_price
    
    return {
        "symbol": symbol,
        "interval": interval,
        "data": data
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)
