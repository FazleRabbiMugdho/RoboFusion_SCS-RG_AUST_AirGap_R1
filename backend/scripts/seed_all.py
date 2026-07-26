import asyncio
import os
import sys
from pathlib import Path

# Add project root to python path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.ml.train_predictor import build_training_data
from backend.scripts.seed_admin import seed as seed_admin
from backend.scripts.seed_sample_data import seed as seed_data
from backend.scripts.seed_sample_data import seed_incidents

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./robofusion.db")
SYNC_DATABASE_URL = DATABASE_URL.replace("+asyncpg", "").replace("+aiosqlite", "")

async def main():
    print("==================================================")
    print("       RoboFusion 1.0 — Unified DB Seeder         ")
    print("==================================================")
    
    print("\n[1/3] Seeding Users (Admin/Staff) and Zones...")
    await seed_admin()
    
    print("\n[2/3] Seeding Sensors, Readings, and Incidents...")
    await seed_data()
    await seed_incidents()
    
    print("\n[3/3] Training ML Risk Predictor...")
    engine = create_engine(SYNC_DATABASE_URL)
    with Session(engine) as session:
        try:
            build_training_data(session)
        except Exception as e:  # noqa: BLE001
            print(f"Error training ML model: {e}")
            
    print("\n==================================================")
    print(" Seeding Complete! Your database is fully loaded. ")
    print(" You can now run the backend and frontend.        ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(main())
