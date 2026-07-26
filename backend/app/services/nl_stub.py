import logging

from backend.app.schemas.enums import HazardType

logger = logging.getLogger(__name__)

# Keyword maps for hazard type detection
HAZARD_KEYWORDS = {
    HazardType.FLAME: ["fire", "flame", "smoke", "burn", "blaze", "ignition", "flare"],
    HazardType.GAS: ["gas", "smell", "fumes", "odor", "leak", "methane", "propane", "co2", "carbon monoxide"],
    HazardType.WATER: ["water", "flood", "leak", "spill", "pipe", "burst", "drip", "wet", "moisture"],
}

# Zone name keywords (partial matches for stub)
ZONE_KEYWORDS = {
    "Lab A — Assembly": ["assembly", "lab a", "lab a assembly"],
    "Lab B — Battery Bay": ["battery", "lab b", "lab b battery", "bay"],
    "Lab C — Cleanroom": ["cleanroom", "lab c", "lab c cleanroom", "clean room"],
    "Lab D — Storage": ["storage", "lab d", "lab d storage", "warehouse"],
    "Lab E — Testing": ["testing", "lab e", "lab e testing", "test lab"],
}


def _match_zone(text: str) -> str | None:
    """Match zone name from text using keywords."""
    text_lower = text.lower()
    for zone_name, keywords in ZONE_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return zone_name
    return None


def _match_hazard(text: str) -> HazardType | None:
    """Match hazard type from text using keywords."""
    text_lower = text.lower()
    for hazard, keywords in HAZARD_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                return hazard
    return None


def parse_incident_text_stub(free_text: str) -> dict | None:
    """
    Deterministic offline stub for NL parsing.
    Uses simple keyword matching - no model calls.
    """
    zone_name = _match_zone(free_text)
    hazard_type = _match_hazard(free_text)

    if not zone_name or not hazard_type:
        logger.debug("Stub: no match zone=%s hazard=%s", zone_name, hazard_type)
        return None

    # Fixed moderate defaults
    return {
        "zone_name": zone_name,
        "hazard_type": hazard_type,
        "severity": 0.6,  # moderate default
        "confidence": 0.5,  # just above NL_CONFIDENCE_FLOOR (0.4)
    }