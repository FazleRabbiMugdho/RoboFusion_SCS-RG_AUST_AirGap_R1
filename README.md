# RoboFusion 1.0 (SCS-RG)

Multi-zone hazard-fusion IoT safety grid (RoboFusion 1.0, SCS-RG) spanning 3-5 campus labs. This system fuses sensor data (flame, gas, PIR, water-level) into a centralized risk score, broadcasts via WebSocket to a React 19 dashboard, and triggers localized physical alerts via ESP32.

## Project Structure
- `backend/`: FastAPI Python server, PostgreSQL (Supabase) + SQLAlchemy, ML predictive model (scikit-learn).
- `frontend/`: React 19 + Vite dashboard, modern Figma tokens UI.
- `firmware/`: ESP32 Arduino/C++ source code.

## Quickstart for Developers (Clone & Run)

Follow these instructions to quickly spin up the environment with fully mocked/seeded data.

### 1. Backend Setup
The backend requires Python 3.10+.

```bash
cd backend

# Install requirements
pip install -r requirements.txt

# Run the unified database seeder
# This will setup the database, seed Users (admin/staff), Zones, Sensors, 
# sample Readings, Incidents, and train the ML Risk Predictor.
python scripts/seed_all.py

# Start the FastAPI server on port 8000
uvicorn app.main:app --reload
```

### 2. Frontend Setup
The frontend requires Node.js v20+.

```bash
cd frontend

# Install dependencies (legacy peer deps required)
npm install --legacy-peer-deps

# Start the Vite development server on port 5173
npm run dev
```

### 3. Login Credentials
Once the frontend is running (typically at `http://localhost:5173`), use the following accounts created by the seeder to log in:

- **Admin Account**: Username: `admin` | Password: `adminpassword`
- **Staff Account**: Username: `staff` | Password: `staffpassword`

## Key Architecture Notes
- **WebSocket Broadcasts**: Zone state updates are pushed over websockets to the React dashboard instantly.
- **Role-Based Access**: The dashboard uses Bearer JWTs. The "System Health" override panel is restricted to ADMIN only.
- **ML Predictor**: The backend trains a scikit-learn model offline to forecast CRITICAL hazard states up to 5 minutes into the future.
