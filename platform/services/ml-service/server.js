const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8005;
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:8004';
const ML_PREDICTION_SERVICE_URL = process.env.ML_PREDICTION_SERVICE_URL || 'http://ml-prediction-service:8007';

// Configure axios with timeouts
axios.defaults.timeout = 5000; // 5 seconds default

console.log(`✅ ML Service starting (stateless - uses Analytics Service API)`);
console.log(`📊 Analytics Service URL: ${ANALYTICS_SERVICE_URL}`);
console.log(`🤖 ML Prediction Service URL: ${ML_PREDICTION_SERVICE_URL}`);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'ml-service' });
});

app.get('/predict', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', horizon = 24, interval = '1h' } = req.query;

    // Get OHLCV data from analytics-service
    const response = await axios.get(`${ANALYTICS_SERVICE_URL}/ohlcv/${symbol}`, {
      params: { interval, limit: 100 }
    });

    if (!response.data || !response.data.data || response.data.data.length === 0) {
      return res.status(404).json({ error: 'No price data available for prediction' });
    }

    const candles = response.data.data;
    const prices = candles.map(c => parseFloat(c.close));
    const currentPrice = prices[prices.length - 1];

    // Simple moving average prediction (placeholder for real ML model)
    const recentPrices = prices.slice(-20);
    const avgPrice = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const trend = (currentPrice - avgPrice) / avgPrice;

    // Calculate volatility
    const returns = [];
    for (let i = 1; i < recentPrices.length; i++) {
      returns.push((recentPrices[i] - recentPrices[i - 1]) / recentPrices[i - 1]);
    }
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);

    const prediction = currentPrice * (1 + trend * 0.5);
    const confidence = Math.max(0.5, Math.min(0.95, 0.75 - Math.abs(trend) * 2 - volatility * 10));

    res.json({
      symbol,
      interval,
      horizon: parseInt(horizon),
      current_price: currentPrice,
      predicted_price: prediction,
      prediction_change_pct: ((prediction - currentPrice) / currentPrice * 100).toFixed(2),
      confidence: confidence,
      model: 'simple_ma_trend',
      timestamp: new Date().toISOString(),
      data_points: prices.length
    });
  } catch (error) {
    console.error('Prediction error:', error);
    if (error.response) {
      return res.status(error.response.status).json({ error: error.response.data });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/backtest', async (req, res) => {
  try {
    const { strategy = 'sma_crossover', symbol = 'BTCUSDT', interval = '1h', lookback_days = 30 } = req.body;

    // Get historical data from analytics-service
    const limit = lookback_days * (interval === '1h' ? 24 : interval === '1m' ? 1440 : 288);

    const response = await axios.get(`${ANALYTICS_SERVICE_URL}/ohlcv/${symbol}`, {
      params: { interval, limit: Math.min(limit, 1000) }
    });

    if (!response.data || !response.data.data || response.data.data.length === 0) {
      return res.json({
        strategy,
        symbol,
        interval,
        total_return: 0,
        sharpe_ratio: 0,
        max_drawdown: 0,
        win_rate: 0,
        trades: 0,
        message: 'No historical data found for backtesting'
      });
    }

    const candles = response.data.data;
    const prices = candles.map(c => parseFloat(c.close));

    // Simple SMA crossover strategy backtest
    const shortPeriod = 10;
    const longPeriod = 30;

    let position = 0;
    let cash = 10000; // Starting capital
    let entryPrice = 0;
    let trades = [];

    for (let i = longPeriod; i < prices.length; i++) {
      const shortSMA = prices.slice(i - shortPeriod, i).reduce((a, b) => a + b) / shortPeriod;
      const longSMA = prices.slice(i - longPeriod, i).reduce((a, b) => a + b) / longPeriod;
      const price = prices[i];

      // Buy signal: short MA crosses above long MA
      if (shortSMA > longSMA && position === 0) {
        position = cash / price;
        entryPrice = price;
        cash = 0;
        trades.push({ type: 'buy', price, time: candles[i].open_time });
      }
      // Sell signal: short MA crosses below long MA
      else if (shortSMA < longSMA && position > 0) {
        cash = position * price;
        const pnl = (price - entryPrice) * position;
        trades.push({ type: 'sell', price, time: candles[i].open_time, pnl });
        position = 0;
      }
    }

    // Close any open position
    if (position > 0) {
      cash = position * prices[prices.length - 1];
      position = 0;
    }

    const totalReturn = ((cash - 10000) / 10000) * 100;
    const winningTrades = trades.filter(t => t.pnl && t.pnl > 0).length;
    const totalTrades = trades.filter(t => t.type === 'sell').length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    // Calculate max drawdown and equity curve
    let peak = 10000;
    let maxDrawdown = 0;
    let equity = 10000;
    const returns = [];

    for (const trade of trades) {
      if (trade.type === 'sell') {
        const prevEquity = equity;
        equity += trade.pnl;
        if (equity > peak) peak = equity;
        const drawdown = ((peak - equity) / peak) * 100;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;

        // Calculate return for this trade
        returns.push((equity - prevEquity) / prevEquity);
      }
    }

    // Calculate proper Sharpe Ratio
    // Sharpe = (Mean Return - Risk Free Rate) / Std Dev of Returns
    // Assuming risk-free rate = 0 for simplicity
    let sharpeRatio = 0;
    if (returns.length > 1) {
      const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0) {
        sharpeRatio = meanReturn / stdDev;
        // Annualize (approximate: assuming ~250 trading periods per year)
        sharpeRatio = sharpeRatio * Math.sqrt(250);
      }
    }

    res.json({
      strategy,
      symbol,
      interval,
      lookback_days,
      total_return: totalReturn.toFixed(2),
      total_return_abs: (cash - 10000).toFixed(2),
      sharpe_ratio: sharpeRatio.toFixed(2),
      max_drawdown: maxDrawdown.toFixed(2),
      win_rate: winRate.toFixed(2),
      trades: totalTrades,
      winning_trades: winningTrades,
      losing_trades: totalTrades - winningTrades,
      data_points: prices.length,
      final_equity: cash.toFixed(2)
    });
  } catch (error) {
    console.error('Backtest error:', error);
    if (error.response) {
      return res.status(error.response.status).json({ error: error.response.data });
    }
    res.status(500).json({ error: error.message });
  }
});

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`ML Service running on port ${PORT}`);
  });
}

module.exports = app;
