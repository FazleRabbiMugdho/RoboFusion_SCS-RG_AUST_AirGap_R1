#include "actuators.h"
#include "pins.h"

void activateBuzzer(bool on) {
  digitalWrite(BUZZER_PIN, on ? HIGH : LOW);
  Serial.printf("[%u] Buzzer %s\n", millis() / 1000, on ? "ON" : "OFF");
}

void activateLED(bool on) {
  digitalWrite(LED_PIN, on ? HIGH : LOW);
  Serial.printf("[%u] LED %s\n", millis() / 1000, on ? "ON" : "OFF");
}

// Relay flyback protection:
// Check the relay module's datasheet for onboard opto-isolation/flyback
// protection. If already present (common on opto-isolated modules), no
// additional diode is needed.  If absent, wire a 1N4007 diode across the
// relay coil terminals with the cathode toward the driven (positive) side
// BEFORE the relay is ever energised.  Energising a bare coil without
// flyback protection can spike-reset the ESP32 or drop WiFi.
void activateRelay(bool on) {
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  Serial.printf("[%u] Relay %s\n", millis() / 1000, on ? "ON" : "OFF");
}
