#!/usr/bin/env python3
"""WebSocket soak monitor for multi-zone hardware integration verification.

Connects to /ws/dashboard with ADMIN JWT, records every zone_state_update
and WS disconnect/reconnect event as JSONL with UTC wall-clock timestamps.
Read-only: never sends actuation/override commands.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import websockets
from websockets.exceptions import ConnectionClosedError, ConnectionClosedOK

WS_URL = os.environ.get("WS_URL", "ws://localhost:8000/api/v1/ws/dashboard")
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")
SOAK_DURATION_MINUTES = int(os.environ.get("SOAK_DURATION_MINUTES", "20"))
LOG_DIR = Path(os.environ.get("LOG_DIR", "docs/hardware-verification"))


async def connect_and_monitor(log_path: Path, stop_event: asyncio.Event) -> None:
    """Connect to WebSocket and log all messages until stop_event is set."""
    if not ADMIN_TOKEN:
        print("ERROR: ADMIN_TOKEN environment variable not set", file=sys.stderr)
        return

    uri = f"{WS_URL}?token={ADMIN_TOKEN}"
    headers = {"User-Agent": "soak-monitor/1.0"}

    reconnect_delay = 1.0
    max_reconnect_delay = 30.0

    while not stop_event.is_set():
        try:
            async with websockets.connect(uri, extra_headers=headers) as ws:
                reconnect_delay = 1.0
                print(f"[{utc_now_iso()}] Connected to {uri}", file=sys.stderr)

                log_event(
                    log_path,
                    {
                        "event_type": "ws_connected",
                        "timestamp": utc_now_iso(),
                        "uri": uri,
                    },
                )

                try:
                    async for message in ws:
                        if stop_event.is_set():
                            break

                        try:
                            data = json.loads(message)
                        except json.JSONDecodeError:
                            continue

                        log_event(
                            log_path,
                            {
                                "event_type": "ws_message",
                                "timestamp": utc_now_iso(),
                                "direction": "recv",
                                "payload": data,
                            },
                        )

                        if data.get("type") == "zone_state_update":
                            log_event(
                                log_path,
                                {
                                    "event_type": "zone_state_update",
                                    "timestamp": utc_now_iso(),
                                    "zone_id": data.get("zone_id"),
                                    "zone_name": data.get("zone_name"),
                                    "current_state": data.get("current_state"),
                                    "previous_state": data.get("previous_state"),
                                    "risk_score": data.get("risk_score"),
                                    "risk_breakdown": data.get("risk_breakdown"),
                                    "triggered_at": data.get("triggered_at"),
                                    "connection_count": data.get("connection_count"),
                                    "seq_num": data.get("seq_num"),
                                },
                            )

                except (ConnectionClosedOK, ConnectionClosedError) as e:
                    log_event(
                        log_path,
                        {
                            "event_type": "ws_disconnected",
                            "timestamp": utc_now_iso(),
                            "code": e.code if hasattr(e, "code") else None,
                            "reason": str(e.reason) if hasattr(e, "reason") else str(e),
                        },
                    )
                    print(
                        f"[{utc_now_iso()}] Disconnected: {e.code} {getattr(e, 'reason', '')}",
                        file=sys.stderr,
                    )

        except (ConnectionError, OSError, asyncio.TimeoutError) as e:
            log_event(
                log_path,
                {
                    "event_type": "ws_connection_error",
                    "timestamp": utc_now_iso(),
                    "error": str(e),
                    "type": type(e).__name__,
                },
            )
            print(f"[{utc_now_iso()}] Connection error: {e}", file=sys.stderr)

        if stop_event.is_set():
            break

        print(
            f"[{utc_now_iso()}] Reconnecting in {reconnect_delay:.1f}s...",
            file=sys.stderr,
        )
        await asyncio.sleep(reconnect_delay)
        reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def log_event(log_path: Path, event: dict[str, Any]) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, separators=(",", ":")) + "\n")


async def main() -> int:
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    log_path = LOG_DIR / f"soak_run_{timestamp}.jsonl"

    print("Soak monitor starting", file=sys.stderr)
    print(f"  WS URL: {WS_URL}", file=sys.stderr)
    print(f"  Duration: {SOAK_DURATION_MINUTES} minutes", file=sys.stderr)
    print(f"  Log file: {log_path}", file=sys.stderr)

    stop_event = asyncio.Event()

    async def stop_after_duration() -> None:
        await asyncio.sleep(SOAK_DURATION_MINUTES * 60)
        stop_event.set()
        print(f"[{utc_now_iso()}] Soak duration reached, stopping...", file=sys.stderr)

    monitor_task = asyncio.create_task(connect_and_monitor(log_path, stop_event))
    timer_task = asyncio.create_task(stop_after_duration())

    await asyncio.gather(monitor_task, timer_task, return_exceptions=True)

    log_event(
        log_path,
        {
            "event_type": "soak_complete",
            "timestamp": utc_now_iso(),
            "duration_minutes": SOAK_DURATION_MINUTES,
            "log_file": str(log_path),
        },
    )

    print(f"[{utc_now_iso()}] Soak complete. Log: {log_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(asyncio.run(main()))
    except KeyboardInterrupt:
        print("\nInterrupted", file=sys.stderr)
        sys.exit(130)