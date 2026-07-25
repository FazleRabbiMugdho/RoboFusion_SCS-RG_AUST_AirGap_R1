import asyncio
import logging
import os

import httpx

ZONE_COMMAND_PORT = 8080
REQUEST_TIMEOUT = 2.0

logger = logging.getLogger(__name__)


async def dispatch_actuation_commands(targets: list[tuple[str, dict]]) -> dict[str, bool]:
    api_key = os.environ.get("ZONE_API_KEY", "")

    async def _post_one(ip: str, cmd: dict) -> tuple[str, bool]:
        if not ip:
            logger.warning("dispatch_skip ip_address=None")
            return ("", False)
        url = f"http://{ip}:{ZONE_COMMAND_PORT}/command"
        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
                resp = await client.post(
                    url,
                    json=cmd,
                    headers={"X-Zone-Api-Key": api_key},
                )
                ok = resp.status_code == 200
                if not ok:
                    logger.warning("dispatch_fail ip=%s status=%d", ip, resp.status_code)
                return (ip, ok)
        except httpx.RequestError as exc:
            logger.warning("dispatch_error ip=%s exc=%s", ip, exc)
            return (ip, False)

    tasks = [_post_one(ip, cmd) for ip, cmd in targets if ip]
    skipped = [ip for ip, _ in targets if not ip]
    for ip in skipped:
        logger.warning("dispatch_skip ip_address=%s", ip)

    results = await asyncio.gather(*tasks, return_exceptions=True)

    out: dict[str, bool] = {}
    for r in results:
        if isinstance(r, tuple):
            ip, ok = r
            out[ip] = ok
        elif isinstance(r, Exception):
            logger.warning("dispatch_unexpected_exc exc=%s", r)
    for ip in skipped:
        out[ip] = False
    return out
