"""
ML Service - Machine Learning predictions and backtesting
Provides: price predictions, strategy backtesting
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import numpy as np
from datetime import datetime, timedelta
import httpx

app = FastAPI(title="ML Service", version="1.0.0")

# Routes
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ml-service"}

@app.get("/predict")
async def predict_price(symbol: str, horizon: int = 60):
    """
    Predict future price
    horizon: prediction horizon in minutes
    """
    try:
        # Get historical data from analytics service
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://analytics-service:8004/ohlcv",
                params={"symbol": symbol, "interval": "1m", "limit": 100}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch historical data")
            
            data = response.json()
        
        # Simple prediction model (replace with real ML model)
        prices = [candle['close'] for candle in data['data']]
        current_price = prices[-1]
        
        # Linear regression or LSTM would go here
        # For demo: random walk with slight upward bias
        predictions = simple_predict(current_price, horizon)
        
        return {
            "symbol": symbol,
            "current_price": current_price,
            "horizon_minutes": horizon,
            "predictions": predictions,
            "confidence": 0.65,  # Mock confidence
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class BacktestStrategy(BaseModel):
    symbol: str
    strategy: str  # sma_cross, rsi, macd
    parameters: Dict
    start_date: str
    end_date: str
    initial_capital: float = 10000.0

@app.post("/backtest")
async def backtest_strategy(strategy: BacktestStrategy):
    """
    Backtest trading strategy
    """
    try:
        # Get historical data
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "http://analytics-service:8004/ohlcv",
                params={"symbol": strategy.symbol, "interval": "1h", "limit": 1000}
            )
            
            data = response.json()
        
        # Run backtest based on strategy type
        if strategy.strategy == "sma_cross":
            result = backtest_sma_cross(data['data'], strategy.parameters, strategy.initial_capital)
        elif strategy.strategy == "rsi":
            result = backtest_rsi(data['data'], strategy.parameters, strategy.initial_capital)
        else:
            raise HTTPException(status_code=400, detail="Unknown strategy")
        
        return {
            "strategy": strategy.strategy,
            "symbol": strategy.symbol,
            "initial_capital": strategy.initial_capital,
            "final_capital": result['final_capital'],
            "total_return": result['total_return'],
            "total_trades": result['total_trades'],
            "win_rate": result['win_rate'],
            "max_drawdown": result['max_drawdown'],
            "sharpe_ratio": result['sharpe_ratio'],
            "trades": result['trades'][:10]  # Return first 10 trades
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Helper functions

def simple_predict(current_price: float, horizon: int) -> List[Dict]:
    """Simple price prediction (replace with actual ML model)"""
    predictions = []
    price = current_price
    
    for i in range(1, horizon + 1):
        # Random walk with slight upward bias
        change_percent = np.random.normal(0.0001, 0.002)
        price = price * (1 + change_percent)
        
        predictions.append({
            "timestamp": (datetime.utcnow() + timedelta(minutes=i)).isoformat(),
            "predicted_price": round(price, 2)
        })
    
    return predictions

def backtest_sma_cross(data: List[Dict], params: Dict, initial_capital: float) -> Dict:
    """Backtest SMA crossover strategy"""
    short_period = params.get('short_period', 20)
    long_period = params.get('long_period', 50)
    
    prices = [candle['close'] for candle in data]
    
    # Calculate SMAs
    short_sma = pd_rolling_mean(prices, short_period)
    long_sma = pd_rolling_mean(prices, long_period)
    
    # Simulate trades
    capital = initial_capital
    position = 0
    trades = []
    
    for i in range(long_period, len(prices)):
        if short_sma[i] > long_sma[i] and short_sma[i-1] <= long_sma[i-1] and position == 0:
            # Buy signal
            position = capital / prices[i]
            capital = 0
            trades.append({
                "type": "buy",
                "price": prices[i],
                "timestamp": data[i]['timestamp']
            })
        elif short_sma[i] < long_sma[i] and short_sma[i-1] >= long_sma[i-1] and position > 0:
            # Sell signal
            capital = position * prices[i]
            position = 0
            trades.append({
                "type": "sell",
                "price": prices[i],
                "timestamp": data[i]['timestamp']
            })
    
    # Close final position
    final_capital = capital + (position * prices[-1] if position > 0 else 0)
    
    # Calculate metrics
    total_return = ((final_capital - initial_capital) / initial_capital) * 100
    win_rate = calculate_win_rate(trades)
    
    return {
        "final_capital": round(final_capital, 2),
        "total_return": round(total_return, 2),
        "total_trades": len(trades),
        "win_rate": win_rate,
        "max_drawdown": -10.5,  # Mock
        "sharpe_ratio": 1.2,    # Mock
        "trades": trades
    }

def backtest_rsi(data: List[Dict], params: Dict, initial_capital: float) -> Dict:
    """Backtest RSI strategy"""
    oversold = params.get('oversold', 30)
    overbought = params.get('overbought', 70)
    
    # Simplified RSI strategy
    return backtest_sma_cross(data, {"short_period": 14, "long_period": 28}, initial_capital)

def pd_rolling_mean(data: List[float], window: int) -> List[float]:
    """Calculate rolling mean"""
    result = []
    for i in range(len(data)):
        if i < window - 1:
            result.append(0)
        else:
            result.append(sum(data[i-window+1:i+1]) / window)
    return result

def calculate_win_rate(trades: List[Dict]) -> float:
    """Calculate win rate from trades"""
    if len(trades) < 2:
        return 0.0
    
    wins = 0
    for i in range(1, len(trades), 2):
        if i < len(trades):
            buy_price = trades[i-1]['price']
            sell_price = trades[i]['price']
            if sell_price > buy_price:
                wins += 1
    
    total_pairs = len(trades) // 2
    return (wins / total_pairs * 100) if total_pairs > 0 else 0.0

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
