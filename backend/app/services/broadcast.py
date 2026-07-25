import asyncio
import logging
from datetime import datetime, timezone
from fastapi import WebSocket
from backend.app.schemas.ws import ZoneStateUpdate
from backend.app.schemas.enums import ZoneState

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket connection manager with lock-safe broadcast.

    Connections list is only mutated under the asyncio.Lock.
    Sends happen outside the lock via asyncio.gather, so one blocked
    client cannot delay delivery to others (Test Case 7a).
    """

    def __init__(self):
        self._connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections.append(ws)
            count = len(self._connections)
        logger.info("ws_connect connection_count=%d", count)

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            if ws in self._connections:
                self._connections.remove(ws)
                count = len(self._connections)
            else:
                count = len(self._connections)
        logger.info("ws_disconnect connection_count=%d", count)

    async def broadcast(
        self,
        zone_id: int,
        zone_name: str,
        current_state: ZoneState,
        previous_state: ZoneState,
        risk_score: float,
    ):
        """Broadcast zone-state update to all connected clients.

        Sends are dispatched via asyncio.gather after releasing the lock,
        so one slow or half-closed connection cannot hold up the lock for
        connect/disconnect (the exact failure Test Case 7a exposes).
        """
        triggered_at = datetime.now(timezone.utc)

        # Snapshot connection list under lock
        async with self._lock:
            targets = list(self._connections)

        connection_count = len(targets)

        logger.info(
            "ws_broadcast zone_id=%d current_state=%s triggered_at=%s connection_count=%d",
            zone_id,
            current_state.value,
            triggered_at.isoformat(),
            connection_count,
        )

        if not targets:
            return

        msg = ZoneStateUpdate(
            zone_id=zone_id,
            zone_name=zone_name,
            current_state=current_state,
            previous_state=previous_state,
            risk_score=round(risk_score, 2),
            triggered_at=triggered_at,
            connection_count=connection_count,
        )
        payload = msg.model_dump_json()

        # Fire all sends concurrently — one failure doesn't block others
        results = await asyncio.gather(
            *[self._safe_send(ws, payload) for ws in targets],
            return_exceptions=True,
        )

        # Remove dead connections (send returned False or raised)
        failed = []
        for ws, ok in zip(targets, results):
            if ok is not True:
                failed.append(ws)

        if failed:
            async with self._lock:
                for ws in failed:
                    if ws in self._connections:
                        self._connections.remove(ws)
                        logger.warning(
                            "ws_send_failed_removed zone_id=%d connection_count=%d",
                            zone_id,
                            len(self._connections),
                        )

    async def _safe_send(self, ws: WebSocket, payload: str) -> bool:
        """Send JSON payload; return True on success, False on failure."""
        try:
            await ws.send_text(payload)
            return True
        except Exception:
            logger.warning("ws_send_error", exc_info=True)
            return False


manager = ConnectionManager()