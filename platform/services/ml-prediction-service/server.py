import os
import pickle
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(title="ML Prediction Service", version="1.0.0")

# Load model and preprocessors at startup
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'enhanced_ultimate_sell_predictor_v2.keras')
SCALER_PATH = os.path.join(MODEL_DIR, 'enhanced_ultimate_sell_predictor_v2_scaler.pkl')
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, 'enhanced_ultimate_sell_predictor_v2_label_encoder.pkl')

print(f"Loading ML model from: {MODEL_PATH}")

try:
    model = tf.keras.models.load_model(MODEL_PATH)
    print(f"✅ Model loaded successfully: {model.summary()}")
except Exception as e:
    print(f"❌ Failed to load model: {e}")
    model = None

try:
    with open(SCALER_PATH, 'rb') as f:
        scaler = pickle.load(f)
    print(f"✅ Scaler loaded successfully")
except Exception as e:
    print(f"❌ Failed to load scaler: {e}")
    scaler = None

try:
    with open(LABEL_ENCODER_PATH, 'rb') as f:
        label_encoder = pickle.load(f)
    print(f"✅ Label encoder loaded successfully")
except Exception as e:
    print(f"❌ Failed to load label encoder: {e}")
    label_encoder = None

# Model configuration
SEQUENCE_LENGTH = 15
THRESHOLD = 0.852637529373169  # From results.json
FEATURE_NAMES = [
    'high', 'sma_20', 'sma_50', 'sma_200', 'bb_middle', 'bb_upper',
    'volatility_10d', 'volatility_14d', 'macd_12_26', 'macd_5_35',
    'macd_signal_5_35', 'below_all_sma'
]


class MLFeature(BaseModel):
    high: float
    sma_20: float
    sma_50: float
    sma_200: float
    bb_middle: float
    bb_upper: float
    volatility_10d: float
    volatility_14d: float
    macd_12_26: float
    macd_5_35: float
    macd_signal_5_35: float
    below_all_sma: int


class PredictionRequest(BaseModel):
    features: List[MLFeature]  # Sequence of features (15 timesteps)
    symbol: Optional[str] = "UNKNOWN"


class PredictionResponse(BaseModel):
    symbol: str
    prediction: str  # "SELL" or "HOLD"
    probability: float
    confidence: float
    signal_strength: str  # "STRONG", "MODERATE", "WEAK"
    model_version: str
    threshold: float


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    model_status = "healthy" if model is not None else "model_not_loaded"
    scaler_status = "healthy" if scaler is not None else "scaler_not_loaded"

    return {
        "status": "healthy" if (model and scaler) else "degraded",
        "service": "ml-prediction-service",
        "model_status": model_status,
        "scaler_status": scaler_status,
        "model_path": MODEL_PATH
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Make a SELL/HOLD prediction using the trained Keras model.

    Requires a sequence of 15 timesteps with 12 features each.
    """
    if model is None or scaler is None:
        raise HTTPException(status_code=503, detail="Model or scaler not loaded")

    if len(request.features) != SEQUENCE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Expected {SEQUENCE_LENGTH} timesteps, got {len(request.features)}"
        )

    try:
        # Convert features to numpy array
        features_array = []
        for feature_set in request.features:
            features_array.append([
                feature_set.high,
                feature_set.sma_20,
                feature_set.sma_50,
                feature_set.sma_200,
                feature_set.bb_middle,
                feature_set.bb_upper,
                feature_set.volatility_10d,
                feature_set.volatility_14d,
                feature_set.macd_12_26,
                feature_set.macd_5_35,
                feature_set.macd_signal_5_35,
                feature_set.below_all_sma
            ])

        features_array = np.array(features_array)  # Shape: (15, 12)

        # Scale features
        features_scaled = scaler.transform(features_array)

        # Reshape for LSTM: (batch_size=1, timesteps=15, features=12)
        features_scaled = features_scaled.reshape(1, SEQUENCE_LENGTH, len(FEATURE_NAMES))

        # Make prediction
        prediction_prob = model.predict(features_scaled, verbose=0)[0][0]

        # Apply threshold
        prediction = "SELL" if prediction_prob >= THRESHOLD else "HOLD"

        # Calculate confidence and signal strength
        confidence = float(prediction_prob)

        if prediction == "SELL":
            if prediction_prob >= 0.95:
                signal_strength = "STRONG"
            elif prediction_prob >= 0.90:
                signal_strength = "MODERATE"
            else:
                signal_strength = "WEAK"
        else:
            signal_strength = "NONE"

        return PredictionResponse(
            symbol=request.symbol,
            prediction=prediction,
            probability=float(prediction_prob),
            confidence=confidence,
            signal_strength=signal_strength,
            model_version="enhanced_ultimate_sell_predictor_v2",
            threshold=THRESHOLD
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.get("/model-info")
async def model_info():
    """Get information about the loaded model"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    return {
        "model_version": "enhanced_ultimate_sell_predictor_v2",
        "sequence_length": SEQUENCE_LENGTH,
        "features": FEATURE_NAMES,
        "threshold": THRESHOLD,
        "expected_performance": {
            "precision": 0.954599761051374,
            "recall": 0.8838495575221239,
            "f1": 0.9178632969557725,
            "auc": 0.9688977758064401
        },
        "trading_metrics": {
            "profit_per_signal": 1.863799283154122,
            "efficiency": 0.8481953290870489,
            "risk_reward_ratio": 21.026315789473685,
            "sharpe_approx": 4.476405437644828
        }
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8007))
    uvicorn.run(app, host="0.0.0.0", port=port)
