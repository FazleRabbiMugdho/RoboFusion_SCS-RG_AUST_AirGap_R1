# Test Case Mapping

| Test Case | Description | Test File | Covers |
|-----------|-------------|-----------|--------|
| **7a** | WebSocket broadcast race — concurrent CRITICAL transitions from 3 zones must reach all connected clients without drops/duplicates | `test_case_7a_broadcast_race.py` | Prompt 17 (`ConnectionManager.broadcast` lock-safe dispatch via `asyncio.gather`) |
| **7b** | Acknowledgment race — two concurrent `POST /acknowledge` for same incident: exactly one `acknowledged`, one `already_acknowledged`, identical `acknowledged_by`/`acknowledged_at` | `test_case_7b_ack_race.py` | Prompt 19 (ON CONFLICT DO NOTHING in `acknowledge_incident`) |
| **13** | RBAC hardening — admin-only endpoints return 401/403 correctly for missing/invalid/wrong-role tokens | `test_rbac_hardening.py` | Prompt 39 (OpenAPI schema verification + runtime 401/403 checks) |
| **24** | State flapping guard — 10 alternating SAFE/WARNING readings produce zero transitions; 2 consecutive WARNING readings commit immediately | `test_case_24_state_flapping.py` | Prompt 14 (`STATE_CONFIRMATION_READINGS = 2` confirmation gate in `determine_zone_state`) |

## Notes

- **Test Case 13** is fully covered by `test_rbac_hardening.py` (Prompt 39). No duplicate test file is created here — this table exists to document the mapping so the coverage is explicit and traceable.
- All tests use `pytest-asyncio` and run against an in-memory SQLite database via the shared `conftest.py` fixtures.
- Run the full suite: `pytest backend/tests -v`