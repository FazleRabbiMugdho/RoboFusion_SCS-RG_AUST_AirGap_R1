import json
import logging
import os

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from backend.app.schemas.enums import HazardType

logger = logging.getLogger(__name__)

NL_CONFIDENCE_FLOOR = 0.4

SYSTEM_INSTRUCTION = """You are a safety incident parser for an industrial IoT system.
Extract structured data from free-text hazard reports.

Output ONLY valid JSON with exactly these fields:
{
  "zone_name": string,  // must match one of the registered zone names exactly
  "hazard_type": "FLAME" | "GAS" | "WATER",  // only these three values
  "severity": number,  // 0.0 to 1.0 normalized severity
  "confidence": number  // 0.0 to 1.0 how confident you are
}

Rules:
- hazard_type must be exactly FLAME, GAS, or WATER
- severity is your assessment of danger level 0.0 (minor) to 1.0 (extreme)
- confidence is your certainty in the extraction 0.0 to 1.0
- zone_name must match a registered zone (you will be given the list)
- If unsure, set confidence below 0.4 to trigger rejection
- No extra fields, no markdown, no explanation - ONLY the JSON object"""

# Cache zone names for validation
_zone_names_cache: list[str] | None = None


async def _get_zone_names(db) -> list[str]:
    """Get list of registered zone names."""
    global _zone_names_cache
    if _zone_names_cache is None:
        from sqlalchemy import select

        from backend.app.models.zone import Zone
        result = await db.execute(select(Zone.name))
        _zone_names_cache = [r[0] for r in result.all()]
    return _zone_names_cache


async def parse_incident_text(free_text: str) -> dict | None:
    """Parse free-text incident report using Gemini."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    # Get registered zone names for the prompt

    from backend.app.database import async_session_maker

    async with async_session_maker() as db:
        zone_names = await _get_zone_names(db)

    prompt = f"""{SYSTEM_INSTRUCTION}

Registered zone names: {zone_names}

User report: "{free_text}"

Output ONLY the JSON object:"""

    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=256,
            ),
        )

        raw = response.text.strip()
        logger.debug("Gemini raw response: %s", raw)

        if not raw:
            logger.warning("Empty Gemini response")
            return None

        # Parse JSON
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError as e:
            logger.warning("Failed to parse Gemini JSON: %s, raw=%s", e, raw)
            return None

        # Validate required fields
        required = ["zone_name", "hazard_type", "severity", "confidence"]
        if not all(k in parsed for k in required):
            logger.warning("Missing required fields in parsed: %s", parsed)
            return None

        # Validate hazard_type
        try:
            parsed["hazard_type"] = HazardType(parsed["hazard_type"])
        except ValueError:
            logger.warning("Invalid hazard_type: %s", parsed.get("hazard_type"))
            return None

        # Validate zone_name matches registered
        if parsed["zone_name"] not in zone_names:
            logger.warning("Unknown zone_name: %s", parsed.get("zone_name"))
            return None

        # Clamp severity and confidence
        parsed["severity"] = max(0.0, min(1.0, float(parsed["severity"])))
        parsed["confidence"] = max(0.0, min(1.0, float(parsed["confidence"])))

        return parsed

    except (genai_errors.APIError, ValueError, json.JSONDecodeError, KeyError, AttributeError) as e:
        logger.error("Gemini API error: %s", e)
        return None