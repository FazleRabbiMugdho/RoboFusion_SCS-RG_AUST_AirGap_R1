#include "water.h"
#include "pins.h"

// WATER_SETTLE_MS = 50 — the one sanctioned blocking delay() call.
// Short enough to stay well within the 30s watchdog and the 500ms poll cadence.
static const uint32_t WATER_SETTLE_MS = 50;

SensorReading readWater() {
  // (a) energise the sensor
  digitalWrite(WATER_POWER_PIN, HIGH);

  // (b) settle — deliberate blocking delay
  delay(WATER_SETTLE_MS);

  // (c) take the reading
  int raw = analogRead(WATER_ANALOG_PIN);

  // (d) de-energise immediately — fail toward de-energised on crash/reboot
  digitalWrite(WATER_POWER_PIN, LOW);

  // (e) normalise
  SensorReading r;
  r.normalized_value = constrain(raw / 4095.0f, 0.0f, 1.0f);
  r.valid            = true;

  return r;
}
