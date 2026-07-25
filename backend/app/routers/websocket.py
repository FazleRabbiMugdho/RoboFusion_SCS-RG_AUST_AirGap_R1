import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from backend.app.core.security import decode_access_token
from backend.app.services.broadcast import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/dashboard")
async def dashboard_ws(ws: WebSocket, token: str | None = Query(None)):
    if not token:
        await ws.close(code=4401)
        return

    payload = decode_access_token(token)
    if "sub" not in payload:
        await ws.close(code=4401)
        return

    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:
        logger.warning("ws_unexpected_error", exc_info=True)
        await manager.disconnect(ws)