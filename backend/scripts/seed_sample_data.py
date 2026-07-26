import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from backend.app.database import async_session_maker, init_db
from backend.app.models.incident import Incident
from backend.app.models.reading import Reading
from backend.app.models.sensor import Sensor
from backend.app.models.zone import Zone
from backend.app.schemas.enums import HazardType, ZoneState

NUM_READINGS_PER_SENSOR = 30


async def seed() -> None:
    await init_db()

    async with async_session_maker() as session:
        zones: list[Zone] = (await session.execute(select(Zone))).scalars().all()
        if not zones:
            print("No zones found — seeding zones first")
            return

        sensor_configs = [
            (HazardType.FLAME, "flame_gas"),
            (HazardType.GAS, "flame_gas"),
            (HazardType.WATER, "water"),
            (HazardType.OCCUPANCY, "pir"),
        ]

        for zone in zones:
            existing = (await session.execute(
                select(Sensor).where(Sensor.zone_id == zone.id)
            )).scalars().all()
            if existing:
                print(f"Zone {zone.id} already has sensors — skipping")
                continue

            for hazard_type, sensor_name in sensor_configs:
                sensor = Sensor(zone_id=zone.id, hazard_type=hazard_type)
                session.add(sensor)
                await session.commit()
                print(f"Zone {zone.id}: created sensor for {hazard_type.value}")

    async with async_session_maker() as session:
        sensors = (await session.execute(select(Sensor))).scalars().all()

        now = datetime.now(timezone.utc)
        for sensor in sensors:
            zone = (await session.execute(
                select(Zone).where(Zone.id == sensor.zone_id)
            )).scalar_one()

            base_values = {
                HazardType.FLAME: (0.0, 0.4),
                HazardType.GAS: (0.0, 0.4),
                HazardType.WATER: (0.0, 0.3),
                HazardType.OCCUPANCY: (0.0, 0.3),
            }
            lo, hi = base_values[sensor.hazard_type]

            for i in range(NUM_READINGS_PER_SENSOR):
                ts = now - timedelta(minutes=(NUM_READINGS_PER_SENSOR - i) * 30)
                norm_val = random.uniform(lo, hi)
                raw_val = norm_val * random.uniform(0.8, 1.2)
                reading = Reading(
                    sensor_id=sensor.id,
                    seq_num=i + 1,
                    raw_value=round(raw_val, 4),
                    normalized_value=round(norm_val, 4),
                    received_at=ts,
                )
                session.add(reading)

            spike_i = random.randint(0, NUM_READINGS_PER_SENSOR - 1)
            ts = now - timedelta(minutes=(NUM_READINGS_PER_SENSOR - spike_i) * 30)
            spike_norm = random.uniform(0.7, 0.95)
            spike_raw = random.uniform(5.0, 9.5)
            reading = Reading(
                sensor_id=sensor.id,
                seq_num=spike_i + 1,
                raw_value=round(spike_raw, 4),
                normalized_value=round(spike_norm, 4),
                received_at=ts,
            )
            session.add(reading)
            await session.commit()
            print(f"Sensor {sensor.id} (zone {sensor.zone_id}, {sensor.hazard_type.value}): seeded {NUM_READINGS_PER_SENSOR + 1} readings")


async def seed_incidents() -> None:
    async with async_session_maker() as session:
        zones = (await session.execute(select(Zone))).scalars().all()
        incidents_data = [
            (ZoneState.WARNING, 42.0, HazardType.FLAME),
            (ZoneState.CRITICAL, 78.5, HazardType.GAS),
            (ZoneState.WARNING, 55.0, HazardType.WATER),
        ]
        for i, (state, score, hazard) in enumerate(incidents_data):
            zone = zones[i % len(zones)]
            incident = Incident(
                zone_id=zone.id,
                status=state,
                primary_hazard_type=hazard,
                risk_score=score,
                triggered_at=datetime.now(timezone.utc) - timedelta(hours=i + 1),
            )
            session.add(incident)
            await session.commit()
            print(f"Incident {i + 1}: zone={zone.id} status={state.value} score={score}")


if __name__ == "__main__":
    async def full_seed():
        await seed()
        await seed_incidents()
    asyncio.run(full_seed())