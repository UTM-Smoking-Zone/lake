# ML Prediction Service

Python-based machine learning prediction service using TensorFlow/Keras for crypto trading signals.

## Model Information

- **Model**: Enhanced Ultimate Sell Predictor v2 (LSTM)
- **Accuracy**: 95.4% precision, 96.8% AUC
- **Purpose**: Predicts SELL signals for cryptocurrency trading
- **Sharpe Ratio**: 4.47 (exceptional)

## Features

- Real-time SELL/HOLD predictions
- Confidence scoring
- Signal strength classification (STRONG/MODERATE/WEAK)
- Production-ready with FastAPI

## API Endpoints

### `POST /predict`

Make a prediction using 15 timesteps of features.

**Request:**
```json
{
  "symbol": "BTCUSDT",
  "features": [
    {
      "high": 43280.0,
      "sma_20": 42850.25,
      "sma_50": 41920.80,
      "sma_200": 39500.15,
      "bb_middle": 42850.25,
      "bb_upper": 44120.50,
      "volatility_10d": 0.0245,
      "volatility_14d": 0.0289,
      "macd_12_26": 125.40,
      "macd_5_35": -45.20,
      "macd_signal_5_35": -38.15,
      "below_all_sma": 0
    }
    // ... 14 more timesteps
  ]
}
```

**Response:**
```json
{
  "symbol": "BTCUSDT",
  "prediction": "SELL",
  "probability": 0.923,
  "confidence": 0.923,
  "signal_strength": "STRONG",
  "model_version": "enhanced_ultimate_sell_predictor_v2",
  "threshold": 0.8526
}
```

### `GET /health`

Health check endpoint.

### `GET /model-info`

Get model metadata and expected performance metrics.

## Running Locally

```bash
pip install -r requirements.txt
python server.py
```

## Environment Variables

- `PORT`: Server port (default: 8007)

## Model Files

- `enhanced_ultimate_sell_predictor_v2.keras` - Trained LSTM model
- `enhanced_ultimate_sell_predictor_v2_scaler.pkl` - Feature scaler
- `enhanced_ultimate_sell_predictor_v2_label_encoder.pkl` - Label encoder
- `enhanced_ultimate_sell_predictor_v2_results.json` - Model performance metrics
