#include "flame_gas.h"
#include "pins.h"

// Flame digital pin is active-low per common flame-module convention.
// LOW = flame detected, HIGH = no flame.
// Confirm polarity against the specific module's datasheet before wiring;
// if active-high, remove the '!' in readFlame().

static const uint32_t GAS_IGNORE_WINDOW_MS = 30000;
static const uint32_t GAS_BASELINE_WINDOW_MS = 120000;

// --- Flame state (debounce across 2 consecutive polls) ---
static int      flame_pending      = HIGH;       // raw value being confirmed
static int      flame_pending_count = 0;
static int      flame_confirmed     = HIGH;       // last confirmed state

void initFlameGas() {
  int raw = !digitalRead(FLAME_DIGITAL_PIN);     // active-low → logical
  flame_pending      = raw;
  flame_pending_count = 1;
  flame_confirmed    = raw;

  Serial.printf("Flame-gas module initialised. "
                "Gas ignore=%ums baseline=%ums\n",
                GAS_IGNORE_WINDOW_MS, GAS_BASELINE_WINDOW_MS);
}

SensorReading readFlame() {
  int raw = !digitalRead(FLAME_DIGITAL_PIN);    // active-low → logical

  // Debounce: need 2 consecutive polls agreeing on a new value
  if (raw == flame_pending) {
    if (flame_pending_count < 2) {
      flame_pending_count++;
    }
    if (flame_pending_count >= 2 && raw != flame_confirmed) {
      flame_confirmed = raw;
      flame_pending_count = 2;   // stay saturated
    }
  } else {
    flame_pending      = raw;
    flame_pending_count = 1;
  }

  SensorReading r;
  r.normalized_value = flame_confirmed ? 1.0f : 0.0f;
  r.valid            = true;
  return r;
}

// --- Gas state (rolling baseline before normalisation) ---
static int      gas_phase         = 0;   // 0=ignore, 1=baselining, 2=active
static float    gas_baseline      = 0.0f;
static uint32_t gas_sample_count  = 0;
static double   gas_accumulator   = 0.0;

SensorReading readGas() {
  SensorReading r;
  int raw = analogRead(GAS_ANALOG_PIN);         // 0-4095

  uint32_t now = millis();

  if (now < GAS_IGNORE_WINDOW_MS) {
    // Phase 0: hard ignore — don't transmit anything
    gas_phase = 0;
    r.normalized_value = 0.0f;
    r.valid            = false;
    return r;
  }

  if (now < GAS_BASELINE_WINDOW_MS) {
    // Phase 1: accumulate baseline
    if (gas_phase != 1) {
      gas_phase         = 1;
      gas_accumulator   = 0.0;
      gas_sample_count  = 0;
    }
    gas_accumulator  += raw;
    gas_sample_count++;

    // Raw-normalise during baseline phase
    r.normalized_value = constrain(raw / 4095.0f, 0.0f, 1.0f);
    r.valid            = true;
    return r;
  }

  // Phase 2: baseline-subtracted normalisation
  if (gas_phase != 2) {
    gas_baseline = gas_sample_count > 0
                   ? (float)(gas_accumulator / gas_sample_count)
                   : (float)raw;
    gas_phase = 2;
    Serial.printf("gas_baseline frozen: %.1f (from %u samples)\n",
                  gas_baseline, gas_sample_count);
  }

  float numerator   = (float)raw - gas_baseline;
  float denominator = 4095.0f - gas_baseline;
  r.normalized_value = constrain(numerator / denominator, 0.0f, 1.0f);
  r.valid            = true;
  return r;
}
