# Multi-Zone Hardware Integration Soak Log

**Project:** RoboFusion 1.0 — SCS-RG  
**Soak Duration:** 20 minutes (SOAK_DURATION_MINUTES)  
**Date (UTC):** __________  
**Log File:** `docs/hardware-verification/soak_run_<UTC-timestamp>.jsonl`  
**Zones Active:** ___ (3–5 zones, list IDs & names)

---

## Zone Inventory

| Zone ID | Zone Name | Lab Type | ESP32 MAC | IP Address | Notes |
|---------|-----------|----------|-----------|------------|-------|
|         |           |          |           |            |       |
|         |           |          |           |            |       |
|         |           |          |           |            |       |
|         |           |          |           |            |       |
|         |           |          |           |            |       |

---

## Deliberate Trigger Log

*Record **real-world trigger timestamp (UTC)** for each deliberate event. Cross-reference against `soak_run_*.jsonl` after the run.*

### Zone ____ — Trigger (a): Flame/Gas Hazard Event

| Trigger # | Real-World Timestamp (UTC) | Trigger Method | JSONL Cross-Ref (line # / triggered_at) | Pass/Fail |
|-----------|----------------------------|----------------|------------------------------------------|-----------|
| 1         |                            |                |                                          |           |

### Zone ____ — Trigger (b): PIR Brief Exit/Re-entry (<2 s)

| Trigger # | Real-World Timestamp (UTC) | Trigger Method | JSONL Cross-Ref (line # / triggered_at) | Pass/Fail |
|-----------|----------------------------|----------------|------------------------------------------|-----------|
| 1         |                            |                |                                          |           |

### Zone ____ — Trigger (c): Relay Actuation (CRITICAL Trigger)

| Trigger # | Real-World Timestamp (UTC) | Trigger Method | JSONL Cross-Ref (line # / triggered_at) | Pass/Fail |
|-----------|----------------------------|----------------|------------------------------------------|-----------|
| 1         |                            |                |                                          |           |

### Zone ____ — Trigger (d): 30+ Second WiFi Outage (this zone only)

| Trigger # | Outage Start (UTC) | Outage End (UTC) | Duration | JSONL Cross-Ref (reconnect line #) | Pass/Fail |
|-----------|--------------------|------------------|----------|-------------------------------------|-----------|
| 1         |                    |                  |          |                                     |           |

---

*Repeat the four trigger tables above for **each zone** (3–5 total).*

---

## Post-Run Verification Checklist

| Check | Description | JSONL Evidence | Pass/Fail |
|-------|-------------|----------------|-----------|
| 1 | `soak_run_*.jsonl` contains ≥1 `zone_state_update` per zone across ~20 min, no unexplained multi-minute gaps outside deliberate WiFi outage | | |
| 2 | **Zero unexpected ESP32 reboots** during any other zone's relay actuation (check ESP32 serial logs + JSONL for missing seq_num) | | |
| 3 | Each zone's PIR held confirmed jumper mode/debounce for full 20 min (no spurious occupancy flips) | | |
| 4 | Outaged zone's cached readings appear in **strictly increasing `seq_num` order** after reconnect; sibling zones' updates show **no gap** during that zone's outage | | |
| 5 | Log template has entry for **every deliberate trigger × every zone**, each cross-referenced by timestamp | | |

---

## Notes / Anomalies Observed

| Timestamp (UTC) | Zone | Observation | Related Trigger? |
|-----------------|------|-------------|------------------|
|                 |      |             |                  |
|                 |      |             |                  |
|                 |      |             |                  |
|                 |      |             |                  |

---

**Completed by:** ___________________   **Date:** __________  
**Reviewed by:** ___________________   **Date:** __________