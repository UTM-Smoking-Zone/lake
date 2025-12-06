const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8004;

function calculateSMA(data, period) {
  const result = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / period);
  }
  return result;
}

function calculateRSI(data, period = 14) {
  const gains = [];
  const losses = [];
  
  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  
  const avgGain = gains.slice(0, period).reduce((a, b) => a + b) / period;
  const avgLoss = losses.slice(0, period).reduce((a, b) => a + b) / period;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  
  return rsi;
}

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'analytics-service' });
});

app.get('/indicators', (req, res) => {
  const { symbol, indicators } = req.query;
  const mockPrices = Array.from({ length: 100 }, () => 89000 + Math.random() * 1000);
  
  const result = {};
  
  if (indicators.includes('sma')) {
    result.sma = calculateSMA(mockPrices, 20);
  }
  
  if (indicators.includes('rsi')) {
    result.rsi = calculateRSI(mockPrices);
  }
  
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
});

module.exports = app;
