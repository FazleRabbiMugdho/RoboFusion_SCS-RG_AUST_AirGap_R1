import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.app.services.broadcast import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/dashboard")
async def dashboard_ws(ws: WebSocket):
    """WebSocket endpoint for the React dashboard.

    No session/JWT check yet — Dashboard Auth & RBAC Middleware will
    retrofit a token check as one of its own steps. If that retrofit
    is skipped, the agent must halt and flag an unauthenticated
    WebSocket endpoint rather than silently shipping it into demo build.
    """
    await manager.connect(ws)
    try:
        while True:
            # Keep the connection alive; the client may send pings
            # or empty frames — just drain them.
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:
        logger.warning("ws_unexpected_error", exc_info=True)
        await manager.disconnect(ws)