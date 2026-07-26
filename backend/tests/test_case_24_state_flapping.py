"""Test Case 24: State Flapping Guard

Verifies the state confirmation gate (STATE_CONFIRMATION_READINGS = 2) prevents
false transitions during rapid flapping between SAFE and WARNING bands.

Tests the core determine_zone_state function directly, since the
end-to-end ingestion pipeline has session management complexities
that are tested separately in Test Case 7a.
"""

from backend.app.schemas.enums import ZoneState
from backend.app.services.risk_fusion import (
    STATE_CONFIRMATION_READINGS,
    classify_risk,
    compute_risk_score,
    determine_zone_state,
)


class FakeZone:
    """Minimal fake zone object for testing determine_zone_state."""
    def __init__(self, current_state, pending_band=None, pending_count=0):
        self.current_state = current_state
        self.pending_band = pending_band
        self.pending_count = pending_count


def test_state_confirmation_readings_constant():
    """Confirm STATE_CONFIRMATION_READINGS is 2."""
    assert STATE_CONFIRMATION_READINGS == 2


def test_safe_band_classification():
    """Risk below 40 classifies as SAFE."""
    score = compute_risk_score(0.1, 0.0, 0.0, False)
    assert classify_risk(score) == ZoneState.SAFE


def test_warning_band_classification():
    """Risk >= 70 classifies as WARNING."""
    score = compute_risk_score(1.0, 1.0, 0.0, False)
    assert classify_risk(score) == ZoneState.WARNING


def test_fake_zone_flapping_no_transition():
    """Alternating SAFE/WARNING readings: pending_count never reaches 2."""
    zone = FakeZone(ZoneState.SAFE)

    # Alternate between SAFE and WARNING 10 times
    for i in range(10):
        band = ZoneState.SAFE if i % 2 == 0 else ZoneState.WARNING
        result_state, _, _ = determine_zone_state(zone, band)
        assert result_state == ZoneState.SAFE

    # After all alternating readings, zone should still be SAFE
    assert zone.current_state == ZoneState.SAFE
    assert zone.pending_count == 1  # Last band was WARNING
    assert zone.pending_band == ZoneState.WARNING


def test_fake_zone_confirmed_transition():
    """2 consecutive WARNING readings after flapping triggers transition."""
    zone = FakeZone(ZoneState.SAFE)

    # First WARNING reading sets pending_band=WARNING, pending_count=1
    result_state, _new_band, _new_count = determine_zone_state(zone, ZoneState.WARNING)
    assert result_state == ZoneState.SAFE
    assert zone.pending_band == ZoneState.WARNING
    assert zone.pending_count == 1

    # Second WARNING reading triggers transition
    result_state, _, _ = determine_zone_state(zone, ZoneState.WARNING)
    assert result_state == ZoneState.WARNING
    assert zone.current_state == ZoneState.WARNING
    assert zone.pending_band is None
    assert zone.pending_count == 0


def test_fake_zone_transition_immediately():
    """Sustained band change: 2 consecutive WARNING from SAFE -> WARNING."""
    zone = FakeZone(ZoneState.SAFE)

    # Two consecutive WARNING readings
    for _ in range(2):
        determine_zone_state(zone, ZoneState.WARNING)

    assert zone.current_state == ZoneState.WARNING


def test_fake_zone_no_false_transition():
    """One WARNING reading then one SAFE: stays SAFE."""
    zone = FakeZone(ZoneState.SAFE)

    determine_zone_state(zone, ZoneState.WARNING)
    determine_zone_state(zone, ZoneState.SAFE)

    assert zone.current_state == ZoneState.SAFE
    assert zone.pending_band == ZoneState.SAFE
    assert zone.pending_count == 1