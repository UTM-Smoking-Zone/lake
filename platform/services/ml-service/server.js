const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8005;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'ml-service' });
});

app.get('/predict', (req, res) => {
  const { symbol, horizon } = req.query;
  const currentPrice = 89000;
  const prediction = currentPrice + (Math.random() - 0.5) * 1000;
  
  res.json({
    symbol,
    horizon: parseInt(horizon),
    current_price: currentPrice,
    predicted_price: prediction,
    confidence: 0.75,
    timestamp: new Date().toISOString()
  });
});

app.post('/backtest', (req, res) => {
  const { strategy, symbol, start_date, end_date } = req.body;
  
  res.json({
    strategy,
    symbol,
    total_return: 15.5,
    sharpe_ratio: 1.2,
    max_drawdown: -8.3,
    win_rate: 0.65,
    trades: 42
  });
});

app.listen(PORT, () => {
  console.log(`ML Service running on port ${PORT}`);
});

module.exports = app;
