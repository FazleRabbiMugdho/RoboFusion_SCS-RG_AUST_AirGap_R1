#include "pir.h"
#include "pins.h"

// PIR_DEBOUNCE_HOLD_MS = 1500ms — a reported state change only fires after
// the raw pin value holds continuously for this duration.
// This prevents brief exit-and-return from logging a false transition.
static const uint32_t PIR_DEBOUNCE_HOLD_MS = 1500;

// Jumper must be set to L (retriggerable) — this code does not verify it.

void initPir() {
  Serial.println("CONFIRM: HC-SR501 jumper set to L (retriggerable) \u2014 see Prompt 11");
}

SensorReading readOccupancy() {
  static bool  last_reported = false;       // last debounced state
  static uint32_t diverged_since = 0;       // millis() when raw != last_reported

  bool raw = digitalRead(PIR_DIGITAL_PIN) == HIGH;

  if (raw == last_reported) {
    diverged_since = 0;
  } else {
    if (diverged_since == 0) {
      diverged_since = millis();
    } else if (millis() - diverged_since >= PIR_DEBOUNCE_HOLD_MS) {
      last_reported = raw;
      diverged_since = 0;
    }
  }

  SensorReading r;
  r.normalized_value = last_reported ? 1.0f : 0.0f;
  r.valid            = true;
  return r;
}
