#include <Arduino.h>
#include "esp_task_wdt.h"
#include "pins.h"
#include "sensors/flame_gas.h"
#include "sensors/pir.h"
#include "sensors/water.h"

void setup() {
  Serial.begin(115200);
  delay(100);  // allow serial monitor to connect

  Serial.println();
  Serial.println("=== RoboFusion 1.0 SCS-RG Boot ===");
  Serial.println("Initialising all output pins to LOW...");

  // All outputs must be LOW before any other init — safe on brownout/reboot.
  pinMode(WATER_POWER_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(WATER_POWER_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(RELAY_PIN, LOW);

  // Inputs
  pinMode(FLAME_DIGITAL_PIN, INPUT);
  pinMode(PIR_DIGITAL_PIN, INPUT);

  // ADC pins (no pinMode needed, but set for consistency)
  pinMode(GAS_ANALOG_PIN, INPUT);
  pinMode(WATER_ANALOG_PIN, INPUT);

  // Log confirmed pin modes
  Serial.println("--- Pin Configuration ---");
  Serial.printf("FLAME_DIGITAL_PIN (GPIO %d): INPUT (active-low)\n", FLAME_DIGITAL_PIN);
  Serial.printf("GAS_ANALOG_PIN    (GPIO %d): INPUT (ADC1)\n", GAS_ANALOG_PIN);
  Serial.printf("PIR_DIGITAL_PIN   (GPIO %d): INPUT\n", PIR_DIGITAL_PIN);
  Serial.printf("WATER_ANALOG_PIN  (GPIO %d): INPUT (ADC1)\n", WATER_ANALOG_PIN);
  Serial.printf("WATER_POWER_PIN   (GPIO %d): OUTPUT (LOW)\n", WATER_POWER_PIN);
  Serial.printf("BUZZER_PIN        (GPIO %d): OUTPUT (LOW)\n", BUZZER_PIN);
  Serial.printf("LED_PIN           (GPIO %d): OUTPUT (LOW)\n", LED_PIN);
  Serial.printf("RELAY_PIN         (GPIO %d): OUTPUT (LOW)\n", RELAY_PIN);
  Serial.println("--- End Pin Configuration ---");

  // Watchdog Timer: 30s timeout, panic on expiry
  esp_task_wdt_init(30, true);
  esp_task_wdt_add(NULL);
  Serial.println("Watchdog: 30s timeout, panic mode enabled");

  initFlameGas();
  initPir();

  Serial.println("=== Boot complete ===\n");
}

static const uint32_t POLL_INTERVAL_MS = 500;

void loop() {
  static uint32_t last_poll = 0;
  uint32_t now = millis();

  if (now - last_poll >= POLL_INTERVAL_MS) {
    last_poll = now;

    SensorReading flame = readFlame();
    SensorReading gas   = readGas();
    SensorReading pir   = readOccupancy();
    SensorReading water = readWater();

    Serial.printf("[%u] Flame=%s Gas=%.3f%s Occ=%s Water=%.2f\n",
                  now / 1000,
                  flame.normalized_value > 0.5f ? "FIRE" : "OK",
                  gas.normalized_value,
                  gas.valid ? "" : " (warming up)",
                  pir.normalized_value > 0.5f ? "PERSON" : "EMPTY",
                  water.normalized_value);
  }

  esp_task_wdt_reset();
}
