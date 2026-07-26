#!/usr/bin/env python3
"""
RoboFusion 1.0 — Simulation CLI
Triggers test scenarios against the running backend for dev & demo recording.

Usage:
  ./simulate.py <scenario> <zone_id> [<zone_id_b>]
  ./simulate.py --help
"""

import hashlib
import hmac
import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASE_URL = os.environ.get("ROBOFUSION_API_URL", "http://localhost:8000")

RAW_API_KEYS = {
    1: "dev-zone-key-001",
    2: "dev-zone-key-002",
    3: "dev-zone-key-003",
    4: "dev-zone-key-004",
    5: "dev-zone-key-005",
}

ZONE_NAMES = {1: "Lab A", 2: "Lab B", 3: "Lab C", 4: "Lab D", 5: "Lab E"}

SEQ_PER_ZONE: dict[int, int] = {}

_SETUP_HINT_PRINTED = False


def _print_setup_hint():
    global _SETUP_HINT_PRINTED
    if _SETUP_HINT_PRINTED:
        return
    _SETUP_HINT_PRINTED = True
    print("  Run './simulate.py --setup' to see SQL for setting zone API keys.\n")


def _print_setup_sql():
    print("  Run these SQL statements in your Supabase SQL Editor:\n")
    for zid, raw in RAW_API_KEYS.items():
        h = _compute_hash(raw)
        print(f"    UPDATE zones SET api_key_hash = '{h}' WHERE id = {zid};")
    print("\n  Raw API keys (send in X-Zone-Api-Key header):")
    for zid, raw in RAW_API_KEYS.items():
        print(f"    Zone {zid} ({ZONE_NAMES[zid]}): {raw}")
    print()


def _load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def _salt() -> bytes:
    return os.environ.get("ZONE_API_KEY_SALT", "robofusion-dev-salt-2026").encode("utf-8")


def _compute_hash(raw: str) -> str:
    return hmac.new(_salt(), raw.encode("utf-8"), hashlib.sha256).hexdigest()


def _hashes_table() -> str:
    lines = [f"  Zone {zid:<3}  {label:<20}  raw={raw}  hash={_compute_hash(raw)}"
             for zid, (label, raw) in {zid: (ZONE_NAMES[zid], RAW_API_KEYS[zid]) for zid in sorted(RAW_API_KEYS)}.items()]
    return "\n".join(lines)


def _db_path() -> str | None:
    root = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(root, "robofusion.db"), os.path.join(root, "backend", "robofusion.db")):
        if os.path.exists(p):
            return p
    return None


def _env_db_url() -> str | None:
    return os.environ.get("DATABASE_URL")


def _ensure_keys():
    db = _db_path()
    if db is not None:
        conn = sqlite3.connect(db)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM zones")
        count = cur.fetchone()[0]
        if count > 0:
            for zid, raw in RAW_API_KEYS.items():
                h = _compute_hash(raw)
                cur.execute("UPDATE zones SET api_key_hash = ? WHERE id = ?", (h, zid))
                if cur.rowcount:
                    print(f"  ✓ Zone {zid} ({ZONE_NAMES[zid]}) API key hash set (SQLite)")
            conn.commit()
            conn.close()
            return
        conn.close()

    db_url = _env_db_url()
    if db_url and "postgresql" in db_url:
        try:
            cleaned = db_url.replace("postgresql+asyncpg://", "postgresql://")
            parts = cleaned.split("@")
            user_pass, host_part = parts[0], parts[1]
            user_pass = user_pass.split(":")
            user, password = user_pass[0], ":".join(user_pass[1:])
            host_part = host_part.split("/")
            host = host_part[0]
            dbname = host_part[1].split("?")[0] if len(host_part) > 1 else ""

            import socket
            socket.getaddrinfo(host.split(":")[0], 5432, socket.AF_INET, socket.SOCK_STREAM)
        except OSError:
            pass
        else:
            env = os.environ.copy()
            env["PGPASSWORD"] = password
            ok = 0
            for zid, raw in RAW_API_KEYS.items():
                h = _compute_hash(raw)
                sql = f"UPDATE zones SET api_key_hash = '{h}' WHERE id = {zid};"
                r = subprocess.run(
                    ["psql", "-h", host, "-U", user, "-d", dbname, "-c", sql],
                    env=env, capture_output=True, text=True, timeout=15, check=False,
                )
                if r.returncode == 0:
                    print(f"  ✓ Zone {zid} ({ZONE_NAMES[zid]}) API key hash set (PostgreSQL)")
                    ok += 1
            if ok:
                return


def _print_setup_sql():
    print("  Run these SQL statements in your Supabase SQL Editor:\n")
    for zid, raw in RAW_API_KEYS.items():
        h = _compute_hash(raw)
        print(f"    UPDATE zones SET api_key_hash = '{h}' WHERE id = {zid};")
    print("\n  Raw API keys (send in X-Zone-Api-Key header):")
    for zid, raw in RAW_API_KEYS.items():
        print(f"    Zone {zid} ({ZONE_NAMES[zid]}): {raw}")
    print()


def _post(zone_id: int, readings: list[dict]) -> dict:
    if zone_id not in SEQ_PER_ZONE:
        SEQ_PER_ZONE[zone_id] = int(time.time() * 1000)
    else:
        SEQ_PER_ZONE[zone_id] = max(SEQ_PER_ZONE[zone_id] + 1, int(time.time() * 1000))
    seq = SEQ_PER_ZONE[zone_id]

    payload = json.dumps({
        "zone_id": zone_id,
        "seq_num": seq,
        "readings": readings,
    }).encode()

    url = f"{BASE_URL}/api/v1/zones/{zone_id}/readings"
    req = urllib.request.Request(
        url, data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Zone-Api-Key": RAW_API_KEYS.get(zone_id, ""),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            return {"ok": True, "status": resp.status, "body": body}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            body = raw.decode(errors="replace")
        if e.code == 401:
            _print_setup_hint()
        return {"ok": False, "status": e.code, "body": body}
    except urllib.error.URLError as e:
        return {"ok": False, "status": 0, "body": str(e.reason)}


def _fmt(res: dict) -> str:
    if isinstance(res["body"], dict):
        s = json.dumps(res["body"])
    else:
        s = str(res["body"])
    if len(s) > 140:
        s = s[:137] + "..."
    return f"HTTP {res['status']}  {s}"


# ── scenarios ──────────────────────────────────────────────────────────────

def do_fire(zid: int):
    print(f"\n  🔥  FIRE  zone {zid}  ({ZONE_NAMES.get(zid,'')})")
    flame = [{"hazard_type": "FLAME", "raw_value": 1.0, "seq_num": 1}]
    zero = [{"hazard_type": "GAS", "raw_value": 0.0, "seq_num": 1},
            {"hazard_type": "WATER", "raw_value": 0.0, "seq_num": 1}]
    seq = [
        flame + zero + [{"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        flame + zero + [{"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        flame + zero + [{"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        flame + zero + [{"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
    ]
    for r in seq:
        _clr(_post(zid, r))
        time.sleep(0.3)


def do_gas(zid: int):
    print(f"\n  💨  GAS LEAK  zone {zid}  ({ZONE_NAMES.get(zid,'')})")
    zero = [{"hazard_type": "FLAME", "raw_value": 0.0, "seq_num": 1},
            {"hazard_type": "WATER", "raw_value": 0.0, "seq_num": 1}]
    seq = [
        zero + [{"hazard_type": "GAS", "raw_value": 0.2, "seq_num": 1}],
        zero + [{"hazard_type": "GAS", "raw_value": 0.5, "seq_num": 1},
                {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "GAS", "raw_value": 0.8, "seq_num": 1},
                {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "GAS", "raw_value": 1.0, "seq_num": 1},
                {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "GAS", "raw_value": 1.0, "seq_num": 1},
                {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "GAS", "raw_value": 1.0, "seq_num": 1},
                {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
    ]
    for r in seq:
        _clr(_post(zid, r))
        time.sleep(0.3)


def do_flood(zid: int):
    print(f"\n  🌊  FLOOD  zone {zid}  ({ZONE_NAMES.get(zid,'')})")
    zero = [{"hazard_type": "FLAME", "raw_value": 0.0, "seq_num": 1},
            {"hazard_type": "GAS", "raw_value": 0.0, "seq_num": 1}]
    seq = [
        zero + [{"hazard_type": "WATER", "raw_value": 0.3, "seq_num": 1}],
        zero + [{"hazard_type": "WATER", "raw_value": 0.6, "seq_num": 1}],
        zero + [{"hazard_type": "WATER", "raw_value": 1.0, "seq_num": 1},
                {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "WATER", "raw_value": 1.0, "seq_num": 1},
                {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "WATER", "raw_value": 1.0, "seq_num": 1},
                {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "WATER", "raw_value": 1.0, "seq_num": 1},
                {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
    ]
    for r in seq:
        _clr(_post(zid, r))
        time.sleep(0.3)


def do_occupied(zid: int):
    print(f"\n  👤  OCCUPIED  zone {zid}  ({ZONE_NAMES.get(zid,'')})")
    zero = [{"hazard_type": "FLAME", "raw_value": 0.0, "seq_num": 1},
            {"hazard_type": "GAS", "raw_value": 0.0, "seq_num": 1},
            {"hazard_type": "WATER", "raw_value": 0.0, "seq_num": 1}]
    seq = [
        zero + [{"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
        zero + [{"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1}],
    ]
    for r in seq:
        _clr(_post(zid, r))
        time.sleep(0.3)


def do_clear(zid: int):
    print(f"\n  ✅  CLEAR  zone {zid}  ({ZONE_NAMES.get(zid,'')})")
    safe = [
        {"hazard_type": "FLAME", "raw_value": 0.0, "seq_num": 1},
        {"hazard_type": "GAS", "raw_value": 0.0, "seq_num": 1},
        {"hazard_type": "WATER", "raw_value": 0.0, "seq_num": 1},
        {"hazard_type": "OCCUPANCY", "raw_value": 0.0, "seq_num": 1},
    ]
    # Send 5 readings over ~10s to keep zone online (staleness threshold = 5s)
    for _ in range(5):
        _clr(_post(zid, safe))
        time.sleep(2.5)


def do_offline(zid: int):
    print(f"\n  📡  OFFLINE  zone {zid}  ({ZONE_NAMES.get(zid,'')})")
    print("  No ingestion request sent. The backend marks a zone OFFLINE")
    print("  after ~30s of missed heartbeats. Stop sending to observe.")


def do_multi(a: int, b: int):
    print(f"\n  ⚡  MULTI  zones {a} & {b}")
    fire = [
        {"hazard_type": "FLAME", "raw_value": 1.0, "seq_num": 1},
        {"hazard_type": "GAS", "raw_value": 0.0, "seq_num": 1},
        {"hazard_type": "WATER", "raw_value": 0.0, "seq_num": 1},
        {"hazard_type": "OCCUPANCY", "raw_value": 1.0, "seq_num": 1},
    ]
    for _ in range(3):
        _clr(_post(a, fire))
        _clr(_post(b, fire))
        time.sleep(0.2)


# ── display ────────────────────────────────────────────────────────────────

def _clr(res: dict):
    ok = res["ok"]
    label = "\033[32m✓\033[0m" if ok else "\033[31m✗\033[0m"
    print(f"    {label}  {_fmt(res)}")


# ── main ───────────────────────────────────────────────────────────────────

HELP = f"""\
\033[1mRoboFusion 1.0 — Simulation CLI\033[0m

Usage:
  ./simulate.py <scenario> <zone_id> [<zone_id_b>]
  ./simulate.py --keep-alive [<zone_id> ...]

Scenarios:
  fire       <id>   Sustained flame sensor → WARNING (fire indicator only)
  gas        <id>   Rising gas concentration → WARNING (gas indicator only)
  flood      <id>   Rising water level → SAFE, water indicator shows
  occupied   <id>   Motion detected → SAFE, occupancy indicator shows
  clear      <id>   All sensors zeroed out   →  SAFE
  offline    <id>   Zone silent (no request)  →  OFFLINE after ~30s
  multi    <a> <b>  Two zones fire simultaneously → WARNING

Flags:
  --keep-alive [ids]  Send heartbeat readings every 15s to keep zones online
                      (default: all 5 zones). Ctrl+C to stop.

Environment:
  ROBOFUSION_API_URL   Backend URL (default: http://localhost:8000)
  ZONE_API_KEY_SALT    HMAC salt (loaded from .env if present)

The script auto-configures zone API keys in the local SQLite DB
or via psql for PostgreSQL.  Raw keys sent in X-Zone-Api-Key:

{_hashes_table()}
"""


def main():
    _load_env()

    if len(sys.argv) < 2 or sys.argv[1] in ("--help", "-h"):
        print(HELP)
        return

    if sys.argv[1] == "--setup":
        _ensure_keys()
        _print_setup_sql()
        return

    cmd = sys.argv[1].lower()

    if cmd == "--keep-alive":
        _ensure_keys()
        zone_ids = [int(a) for a in sys.argv[2:]] if len(sys.argv) > 2 else [1, 2, 3, 4, 5]
        print(f"  ♻  Keep-alive for zones {zone_ids}. Ctrl+C to stop.\n")
        try:
            while True:
                for zid in zone_ids:
                    safe = [
                        {"hazard_type": "FLAME", "raw_value": 0.0, "seq_num": 1},
                        {"hazard_type": "GAS", "raw_value": 0.0, "seq_num": 1},
                        {"hazard_type": "WATER", "raw_value": 0.0, "seq_num": 1},
                        {"hazard_type": "OCCUPANCY", "raw_value": 0.0, "seq_num": 1},
                    ]
                    _clr(_post(zid, safe))
                time.sleep(15)
        except KeyboardInterrupt:
            print("  Stopped.\n")
        return

    table = {
        "fire": (do_fire, 2),
        "gas": (do_gas, 2),
        "flood": (do_flood, 2),
        "occupied": (do_occupied, 2),
        "clear": (do_clear, 2),
        "offline": (do_offline, 2),
        "multi": (do_multi, 3),
    }

    if cmd not in table:
        print(f"  ✗ Unknown scenario '{cmd}'  (try --help)")
        sys.exit(1)

    fn, nargs = table[cmd]
    if len(sys.argv) < nargs:
        print(f"  ✗ '{cmd}' needs {nargs - 1} zone ID(s)")
        sys.exit(1)

    _ensure_keys()

    try:
        if nargs == 2:
            fn(int(sys.argv[2]))
        else:
            fn(int(sys.argv[2]), int(sys.argv[3]))
    except ValueError:
        print("  ✗ Zone ID must be an integer")
        sys.exit(1)


if __name__ == "__main__":
    main()