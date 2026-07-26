#!/usr/bin/env bash
set -euo pipefail

# RoboFusion 1.0 — Backend Setup Script
# Run from the repo root after ensuring PostgreSQL is running.
#
# Usage:
#   bash backend/scripts/setup.sh

cd "$(dirname "$0")/.."

echo "=== Installing Python dependencies ==="
pip install --break-system-packages -r requirements.txt 2>/dev/null || pip install -r requirements.txt

echo "=== Running database migrations ==="
alembic upgrade head

echo "=== Seeding admin user ==="
if [ -z "${ADMIN_SEED_PASSWORD:-}" ]; then
  echo "ADMIN_SEED_PASSWORD not set — you can seed manually later:"
  echo "  ADMIN_SEED_USERNAME=admin ADMIN_SEED_PASSWORD=<secret> python -m backend.scripts.seed_admin"
else
  ADMIN_SEED_USERNAME="${ADMIN_SEED_USERNAME:-admin}" python -m backend.scripts.seed_admin
fi

echo "=== Seeding zone row ==="
if [ -z "${ZONE_API_KEY:-}" ]; then
  echo "ZONE_API_KEY not set — you can seed manually later:"
  echo "  ZONE_ID=1 ZONE_NAME='Main Lab' ZONE_LAB_TYPE=IOT_LAB ZONE_API_KEY=dev-zone-key-001 python -m backend.scripts.seed_zone"
else
  ZONE_ID="${ZONE_ID:-1}" ZONE_NAME="${ZONE_NAME:-Main Lab}" ZONE_LAB_TYPE="${ZONE_LAB_TYPE:-IOT_LAB}" python -m backend.scripts.seed_zone
fi

echo "=== Backend ready — start with ==="
echo "  uvicorn app.main:app --reload"
