import json
import logging
from pathlib import Path

import joblib

from backend.ml.features import FEATURE_ORDER, extract_feature_vector

logger = logging.getLogger(__name__)

MODEL_PATH = Path(__file__).resolve().parents[2] / "ml" / "model_artifacts" / "risk_predictor.joblib"
METADATA_PATH = Path(__file__).resolve().parents[2] / "ml" / "model_artifacts" / "metadata.json"

MIN_TRAINING_SAMPLES = 50

_model = None
_metadata = None


def _load_model():
    global _model, _metadata

    if _model is not None and _metadata is not None:
        return

    if not MODEL_PATH.exists() or not METADATA_PATH.exists():
        logger.info("Model or metadata file not found at %s / %s", MODEL_PATH, METADATA_PATH)
        return

    try:
        _model = joblib.load(MODEL_PATH)
        _metadata = json.loads(METADATA_PATH.read_text())
    except (OSError, json.JSONDecodeError) as e:
        logger.error("Failed to load risk predictor model: %s", e)
        _model = None
        _metadata = None
        return

    if _metadata.get("sample_count", 0) < MIN_TRAINING_SAMPLES:
        logger.warning("Model has insufficient training samples: %d < %d", _metadata["sample_count"], MIN_TRAINING_SAMPLES)
        _model = None
        _metadata = None
        return

    if _metadata.get("feature_order") != FEATURE_ORDER:
        logger.warning("Feature order mismatch: expected %s, got %s", FEATURE_ORDER, _metadata.get("feature_order"))
        _model = None
        _metadata = None
        return

    logger.info("Risk predictor model loaded: trained_at=%s, samples=%d", _metadata.get("trained_at"), _metadata.get("sample_count"))


def predict_zone_risk(fire_norm: float, gas_norm: float, water_norm: float, occupied: bool) -> float | None:
    _load_model()

    if _model is None:
        return None

    try:
        features = extract_feature_vector(fire_norm, gas_norm, water_norm, occupied)
        proba = _model.predict_proba([features])[0]
        return float(proba[1]) if len(proba) > 1 else None
    except (AttributeError, ValueError) as e:
        logger.error("Risk prediction failed: %s", e)
        return None