import os
import pickle
import logging
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import List, Optional
import uvicorn
from datetime import datetime
import joblib

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="ML Prediction Service", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model and preprocessors at startup
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
MODEL_PATH = os.path.join(MODEL_DIR, 'enhanced_ultimate_sell_predictor_v2.keras')
SCALER_PATH = os.path.join(MODEL_DIR, 'enhanced_ultimate_sell_predictor_v2_scaler.pkl')
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, 'enhanced_ultimate_sell_predictor_v2_label_encoder.pkl')

logger.info(f"Loading ML model from: {MODEL_PATH}")

model = None
scaler = None
label_encoder = None
model_load_error = None

# Try to load model with different methods
try:
    # Try with custom objects for Keras compatibility
    try:
        import keras
        from keras.initializers import Orthogonal, GlorotUniform, Zeros
        custom_objects = {
            'Orthogonal': Orthogonal,
            'GlorotUniform': GlorotUniform,
            'Zeros': Zeros
        }
        model = keras.models.load_model(MODEL_PATH, custom_objects=custom_objects)
        logger.info(f"✅ Model loaded successfully with Keras 3 and custom objects")
    except Exception as e1:
        logger.warning(f"Keras loading failed: {e1}")
        # Try TensorFlow with custom objects
        try:
            from tensorflow.keras.initializers import Orthogonal, GlorotUniform, Zeros
            custom_objects = {
                'Orthogonal': Orthogonal,
                'GlorotUniform': GlorotUniform,
                'Zeros': Zeros
            }
            model = tf.keras.models.load_model(MODEL_PATH, custom_objects=custom_objects, compile=False)
            logger.info(f"✅ Model loaded successfully with TensorFlow and custom objects")
        except Exception as e2:
            logger.warning(f"TensorFlow loading also failed: {e2}")
            # Create a simple stub model for predictions
            model = None
            logger.warning("🔄 Using fallback prediction method due to model loading issues")
            
except Exception as e:
    logger.error(f"❌ Failed to load model: {e}")
    model_load_error = str(e)
    model = None

# Try to load scaler
try:
    try:
        # First try joblib
        scaler = joblib.load(SCALER_PATH)
        logger.info(f"✅ Scaler loaded successfully with joblib")
    except:
        # Fallback to pickle
        with open(SCALER_PATH, 'rb') as f:
            scaler = pickle.load(f)
        logger.info(f"✅ Scaler loaded successfully with pickle")
except Exception as e:
    logger.error(f"❌ Failed to load scaler: {e}")
    model_load_error = str(e) if not model_load_error else model_load_error
    scaler = None

# Try to load label encoder
try:
    try:
        # First try joblib
        label_encoder = joblib.load(LABEL_ENCODER_PATH)
        logger.info(f"✅ Label encoder loaded successfully with joblib")
    except:
        # Fallback to pickle
        with open(LABEL_ENCODER_PATH, 'rb') as f:
            label_encoder = pickle.load(f)
        logger.info(f"✅ Label encoder loaded successfully with pickle")
except Exception as e:
    logger.error(f"❌ Failed to load label encoder: {e}")
    model_load_error = str(e) if not model_load_error else model_load_error
    label_encoder = None

# Model configuration
SEQUENCE_LENGTH = 7  # Adjusted for available data
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
    
    @field_validator('high', 'sma_20', 'sma_50', 'sma_200', 'bb_middle', 'bb_upper',
               'volatility_10d', 'volatility_14d', 'macd_12_26', 'macd_5_35',
               'macd_signal_5_35')
    @classmethod
    def validate_numeric(cls, v):
        if not isinstance(v, (int, float)):
            raise ValueError('must be numeric')
        if np.isnan(v) or np.isinf(v):
            raise ValueError('cannot be NaN or Inf')
        return v
    
    @field_validator('below_all_sma')
    @classmethod
    def validate_binary(cls, v):
        if v not in [0, 1]:
            raise ValueError('must be 0 or 1')
        return v


class PredictionRequest(BaseModel):
    features: List[MLFeature]  # Sequence of features (15 timesteps)
    symbol: Optional[str] = "UNKNOWN"
    
    @field_validator('symbol')
    @classmethod
    def validate_symbol(cls, v):
        if not v or len(v) > 20:
            raise ValueError('symbol must be 1-20 characters')
        return v
    
    @field_validator('features')
    @classmethod
    def validate_features_length(cls, v):
        if len(v) != SEQUENCE_LENGTH:
            raise ValueError(f'expected {SEQUENCE_LENGTH} timesteps, got {len(v)}')
        return v


class PredictionResponse(BaseModel):
    symbol: str
    prediction: str  # "SELL" or "HOLD"
    probability: float
    confidence: float
    signal_strength: str  # "STRONG", "MODERATE", "WEAK"
    model_version: str
    threshold: float
    timestamp: str


@app.get("/health")
async def health_check():
    """Health check endpoint with detailed service status"""
    
    model_status = "healthy" if model is not None else "fallback_mode"
    scaler_status = "healthy" if scaler is not None else "not_loaded"
    
    # Service is healthy if scaler works, even without model
    service_healthy = scaler is not None

    return {
        "status": "healthy" if service_healthy else "degraded",
        "service": "ml-prediction-service",
        "model_status": model_status,
        "scaler_status": scaler_status,
        "prediction_method": "keras_model" if model else "fallback_algorithm",
        "timestamp": datetime.utcnow().isoformat(),
        "model_path": MODEL_PATH,
        "note": "Using fallback algorithm when Keras model unavailable" if not model else "Using trained Keras model"
    }


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Make a SELL/HOLD prediction using the trained Keras model or fallback algorithm.
    
    Requires a sequence of 15 timesteps with 12 features each.
    Validates all features for NaN/Inf and appropriate ranges.
    """
    logger.info(f"Prediction request for {request.symbol} with {len(request.features)} features")
    
    # Add detailed logging for debugging
    logger.info(f"Request details: symbol={request.symbol}, features_count={len(request.features)}")
    if len(request.features) > 0:
        logger.info(f"Sample feature: {request.features[0].__dict__}")
    
    if scaler is None:
        logger.error("Scaler not loaded")
        raise HTTPException(
            status_code=503,
            detail="Scaler not loaded. Service degraded."
        )

    try:
        # Convert features to numpy array
        features_array = []
        for idx, feature_set in enumerate(request.features):
            feature_values = [
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
            ]
            
            # Check for NaN or Inf values
            if any(np.isnan(v) or np.isinf(v) for v in feature_values if isinstance(v, float)):
                raise ValueError(f"Invalid feature values at timestep {idx}")
            
            features_array.append(feature_values)

        features_array = np.array(features_array, dtype=np.float32)  # Shape: (15, 12)

        # Scale features using fitted scaler
        features_scaled = scaler.transform(features_array)

        # Reshape for LSTM: (batch_size=1, timesteps=15, features=12)
        features_scaled = features_scaled.reshape(1, SEQUENCE_LENGTH, len(FEATURE_NAMES))

        # Make prediction with model or fallback
        if model is not None:
            # Use trained Keras model
            prediction_prob = float(model.predict(features_scaled, verbose=0)[0][0])
            logger.info(f"Using trained Keras model for prediction")
        else:
            # Fallback algorithm based on technical analysis
            logger.warning("Model not available, using fallback algorithm")
            
            # Get last few features for analysis
            latest_features = request.features[-3:]  # Last 3 timesteps
            
            # Calculate trend indicators
            price_trend = 0
            volatility_trend = 0
            momentum_trend = 0
            
            for i, fs in enumerate(latest_features):
                # Price trend (below all SMAs is bearish)
                if fs.below_all_sma > 0.5:
                    price_trend += 0.3 * (i + 1)  # Weight recent more
                
                # High volatility suggests potential moves
                if fs.volatility_14d > 0.02:  # Above 2% daily volatility
                    volatility_trend += 0.2 * (i + 1)
                    
                # MACD momentum
                if fs.macd_12_26 < 0 and fs.macd_5_35 < fs.macd_signal_5_35:
                    momentum_trend += 0.2 * (i + 1)
                
            # Combine indicators
            prediction_prob = min(0.99, max(0.01, (price_trend + volatility_trend + momentum_trend) / 3.0))

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

        logger.info(f"Prediction complete: {request.symbol} -> {prediction} (prob: {prediction_prob:.4f})")

        return PredictionResponse(
            symbol=request.symbol,
            prediction=prediction,
            probability=prediction_prob,
            confidence=confidence,
            signal_strength=signal_strength,
            model_version="enhanced_ultimate_sell_predictor_v2" if model else "fallback_algorithm",
            threshold=THRESHOLD,
            timestamp=datetime.utcnow().isoformat()
        )

    except ValueError as ve:
        logger.error(f"Validation error: {str(ve)}")
        raise HTTPException(status_code=400, detail=f"Invalid features: {str(ve)}")
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.get("/model-info")
async def model_info():
    """Get information about the loaded model"""
    if model is None:
        logger.warning("Model info requested but model not loaded")
        raise HTTPException(status_code=503, detail="Model not loaded")

    logger.info("Model info requested")
    
    return {
        "model_version": "enhanced_ultimate_sell_predictor_v2",
        "sequence_length": SEQUENCE_LENGTH,
        "features": FEATURE_NAMES,
        "feature_count": len(FEATURE_NAMES),
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
        },
        "model_loaded": True,
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8007))
    logger.info(f"Starting ML Prediction Service on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
