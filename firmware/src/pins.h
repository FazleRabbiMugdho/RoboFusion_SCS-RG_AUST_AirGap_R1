#ifndef PINS_H
#define PINS_H

// ============================================================
// Shared Pin Map — RoboFusion 1.0 SCS-RG
// Every pin number is defined here and only here.
// Included by every later firmware module (Prompts 10-13).
// ============================================================

// Analog pins MUST use ADC1 (GPIO 32-39) — ADC2 is unreliable
// when WiFi is active.

// --- Sensors ---
#define FLAME_DIGITAL_PIN  27   // digital input, active-low  (Prompt 10)
#define GAS_ANALOG_PIN     34   // analog input, ADC1         (Prompt 10)
#define PIR_DIGITAL_PIN    25   // digital input              (Prompt 11)
#define WATER_ANALOG_PIN   35   // analog input, ADC1         (Prompt 12)
#define WATER_POWER_PIN    26   // digital output, duty-cycled VCC (Prompt 12)

// --- Actuators ---
#define BUZZER_PIN         32   // digital output             (Prompt 13)
#define LED_PIN            33   // digital output             (Prompt 13)
#define RELAY_PIN          14   // digital output             (Prompt 13)

#endif  // PINS_H
