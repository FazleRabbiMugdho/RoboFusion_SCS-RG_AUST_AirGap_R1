import asyncio
import json
import logging
import os
from datetime import datetime

import httpx

logger = logging.getLogger(__name__)

DISCORD_RED = 14427686  # decimal for #DC2626


def _append_stub(path: str, line: str) -> None:
    with open(path, "a") as f:
        f.write(line + "\n")


async def send_remote_alert(
    zone_name: str,
    risk_score: float,
    primary_hazard_type: str | None,
    triggered_at: datetime,
) -> None:
    use_stub = os.environ.get("USE_LOCAL_STUB", "false").lower() == "true"
    webhook_url = os.environ.get("DISCORD_WEBHOOK_URL", "")

    embed = {
        "embeds": [
            {
                "title": f"CRITICAL — {zone_name}",
                "description": (
                    f"Risk score {risk_score:.1f} · "
                    f"primary hazard: {primary_hazard_type or 'unknown'}"
                ),
                "color": DISCORD_RED,
                "timestamp": triggered_at.isoformat(),
            }
        ]
    }

    if use_stub:
        stub_dir = "backend/tests/fixtures"
        os.makedirs(stub_dir, exist_ok=True)
        stub_path = os.path.join(stub_dir, "remote_alert_stub_log.jsonl")
        line = json.dumps(embed)
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _append_stub, stub_path, line)
        logger.info("remote_alert_stub zone=%s written to %s", zone_name, stub_path)
        return

    if not webhook_url:
        logger.warning("remote_alert_skipped zone=%s DISCORD_WEBHOOK_URL not set", zone_name)
        return

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(webhook_url, json=embed)
            resp.raise_for_status()
        logger.info("remote_alert_sent zone=%s status=%d", zone_name, resp.status_code)
    except httpx.HTTPError as exc:
        logger.warning("remote_alert_failed zone=%s exc=%s", zone_name, exc)
