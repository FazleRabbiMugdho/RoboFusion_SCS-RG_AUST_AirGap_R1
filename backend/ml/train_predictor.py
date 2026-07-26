import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.app.models.base import Base
from backend.app.models.incident import Incident
from backend.app.models.reading import Reading
from backend.app.models.sensor import Sensor
from backend.app.schemas.enums import HazardType, ZoneState
from backend.ml.features import FEATURE_ORDER, extract_feature_vector

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./robofusion.db")
SYNC_DATABASE_URL = DATABASE_URL.replace("+asyncpg", "").replace("+aiosqlite", "")

PREDICTION_HORIZON_MINUTES = 5
MIN_TRAINING_SAMPLES = 50

ARTIFACTS_DIR = Path(__file__).parent / "model_artifacts"
MODEL_PATH = ARTIFACTS_DIR / "risk_predictor.joblib"
METADATA_PATH = ARTIFACTS_DIR / "metadata.json"


def build_training_data(session: Session):
    readings = session.execute(
        select(Reading)
        .join(Sensor, Reading.sensor_id == Sensor.id)
        .order_by(Reading.received_at.asc())
    ).scalars().all()

    sensor_by_zone_hazard: dict[tuple[int, HazardType], Sensor] = {}
    for s in session.execute(select(Sensor)).scalars().all():
        sensor_by_zone_hazard[(s.zone_id, s.hazard_type)] = s

    incidents = session.execute(
        select(Incident).where(Incident.status == ZoneState.CRITICAL)
    ).scalars().all()
    critical_incidents_by_zone: dict[int, list[datetime]] = {}
    for inc in incidents:
        critical_incidents_by_zone.setdefault(inc.zone_id, []).append(inc.triggered_at)

    X = []
    y = []

    for r in readings:
        sensor = sensor_by_zone_hazard.get((r.sensor.zone_id, r.sensor.hazard_type))
        if not sensor:
            continue
        zone_id = sensor.zone_id

        latest_per_hazard: dict[HazardType, float] = {}
        for ht in HazardType:
            s = sensor_by_zone_hazard.get((zone_id, ht))
            if not s:
                latest_per_hazard[ht] = 0.0
                continue
            latest_reading = session.execute(
                select(Reading.normalized_value)
                .where(Reading.sensor_id == s.id, Reading.received_at <= r.received_at)
                .order_by(Reading.received_at.desc())
                .limit(1)
            ).scalar()
            latest_per_hazard[ht] = latest_reading if latest_reading is not None else 0.0

        fire_norm = latest_per_hazard.get(HazardType.FLAME, 0.0)
        gas_norm = latest_per_hazard.get(HazardType.GAS, 0.0)
        water_norm = latest_per_hazard.get(HazardType.WATER, 0.0)
        occ_norm = latest_per_hazard.get(HazardType.OCCUPANCY, 0.0)
        occupied = occ_norm >= 0.5

        feature_vector = extract_feature_vector(fire_norm, gas_norm, water_norm, occupied)

        label = 0
        zone_criticals = critical_incidents_by_zone.get(zone_id, [])
        horizon_end = r.received_at + timedelta(minutes=PREDICTION_HORIZON_MINUTES)
        for ci_time in zone_criticals:
            if r.received_at <= ci_time <= horizon_end:
                label = 1
                break

        X.append(feature_vector)
        y.append(label)

    return np.array(X), np.array(y)


def main():
    print(f"Connecting to {SYNC_DATABASE_URL}")
    engine = create_engine(SYNC_DATABASE_URL, echo=False)
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        print("Building training data...")
        X, y = build_training_data(session)
        print(f"Total samples: {len(X)}, Positive: {y.sum()}, Negative: {len(y) - y.sum()}")

        if len(X) < MIN_TRAINING_SAMPLES:
            print(f"Insufficient training data: {len(X)} < {MIN_TRAINING_SAMPLES}")
            print("Model NOT trained. Remove this check after sufficient data accumulates.")
            return

        print("Training LogisticRegression with StandardScaler...")
        model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000, class_weight="balanced"))
        model.fit(X, y)

        ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, MODEL_PATH)

        metadata = {
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "sample_count": len(X),
            "positive_count": int(y.sum()),
            "feature_order": FEATURE_ORDER,
        }
        METADATA_PATH.write_text(json.dumps(metadata, indent=2))

        print(f"Model saved to {MODEL_PATH}")
        print(f"Metadata saved to {METADATA_PATH}")


if __name__ == "__main__":
    main()