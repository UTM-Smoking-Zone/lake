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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

console.log(`✅ ML Service starting (stateless - uses Analytics Service API)`);
console.log(`📊 Analytics Service URL: ${ANALYTICS_SERVICE_URL}`);
console.log(`🤖 ML Prediction Service URL: ${ML_PREDICTION_SERVICE_URL}`);

app.get('/health', async (req, res) => {
  try {
    // Check analytics service
    const analyticsHealth = await axios.get(`${ANALYTICS_SERVICE_URL}/health`, {
      timeout: 2000
    }).catch(() => ({ data: { status: 'unavailable' } }));

    // Check ML prediction service
    const mlHealth = await axios.get(`${ML_PREDICTION_SERVICE_URL}/health`, {
      timeout: 2000
    }).catch(() => ({ data: { status: 'unavailable' } }));

    const status = (analyticsHealth.data.status === 'healthy' && mlHealth.data.status === 'healthy') 
      ? 'healthy' 
      : 'degraded';

    res.status(status === 'healthy' ? 200 : 503).json({
      status,
      service: 'ml-service',
      dependencies: {
        analytics_service: analyticsHealth.data.status,
        ml_prediction_service: mlHealth.data.status
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'ml-service',
      error: error.message
    });
  }
});

app.get('/predict', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', horizon = 24, interval = '1h' } = req.query;

    // Validate inputs
    if (!symbol || !/^[A-Z0-9]{2,20}$/.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol format' });
    }

    // Get ML features from analytics service
    const featuresResponse = await axios.get(`${ANALYTICS_SERVICE_URL}/ml-features/${symbol}`, {
      params: { interval, limit: 15 },
      timeout: 5000
    });

    if (!featuresResponse.data || !featuresResponse.data.features) {
      return res.status(400).json({ error: 'Failed to retrieve ML features' });
    }

    const features = featuresResponse.data.features;
    const currentPrice = featuresResponse.data.current_price;

    // Validate all required features are present
    const requiredFeatures = [
      'high', 'sma_20', 'sma_50', 'sma_200', 'bb_middle', 'bb_upper',
      'volatility_10d', 'volatility_14d', 'macd_12_26', 'macd_5_35',
      'macd_signal_5_35', 'below_all_sma'
    ];

    const missingFeatures = requiredFeatures.filter(f => !(f in features));
    if (missingFeatures.length > 0) {
      return res.status(400).json({
        error: 'Incomplete feature data',
        missing_features: missingFeatures
      });
    }

    // Call actual ML prediction service
    let prediction;
    try {
      const mlResponse = await axios.post(`${ML_PREDICTION_SERVICE_URL}/predict`, {
        features: [features], // Wrap single feature set in array for 15-day sequence
        symbol: symbol
      }, {
        timeout: 5000
      });

      prediction = mlResponse.data;
    } catch (mlError) {
      console.error('ML Prediction Service error:', mlError.message);
      return res.status(503).json({
        error: 'ML Prediction Service unavailable',
        detail: mlError.message
      });
    }

    res.json({
      symbol,
      interval,
      horizon: parseInt(horizon),
      current_price: currentPrice,
      ml_signal: prediction.prediction,
      probability: prediction.probability,
      confidence: prediction.confidence,
      signal_strength: prediction.signal_strength,
      model_version: prediction.model_version,
      threshold: prediction.threshold,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Prediction error:', error.message);
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'Downstream service error',
        detail: error.response.data
      });
    }
    res.status(500).json({
      error: 'Prediction failed',
      detail: error.message
    });
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
    console.log(`\n✅ ML Service running on port ${PORT}`);
    console.log(`📊 Endpoints:`);
    console.log(`   GET  /health - Service health status`);
    console.log(`   GET  /predict?symbol=BTCUSDT&interval=1h - Get ML prediction`);
    console.log(`   POST /backtest - Backtest trading strategy\n`);
  });
}

module.exports = app;
