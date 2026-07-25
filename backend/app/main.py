from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.database import init_db
from backend.app.routers import incidents, readings, websocket, zones


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="RoboFusion 1.0 API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(readings.router, prefix="/api/v1")
app.include_router(websocket.router, prefix="/api/v1")
app.include_router(zones.router, prefix="/api/v1")
app.include_router(incidents.router, prefix="/api/v1")