#include <Arduino.h>
#include <Preferences.h>
#include "esp_task_wdt.h"
#include "pins.h"
#include "sensors/flame_gas.h"
#include "sensors/pir.h"
#include "sensors/water.h"
#include "actuators/actuators.h"
#include "network/wifi_manager.h"
#include "network/command_server.h"
#include "network/ingestion_client.h"
#include "network/offline_cache.h"
#include "secrets.h"

static Preferences prefs;

void setup() {
    Serial.begin(115200);
    delay(100);

    Serial.println();
    Serial.println("=== RoboFusion 1.0 SCS-RG Boot ===");
    Serial.println("Initialising all output pins to LOW...");

    pinMode(WATER_POWER_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(LED_PIN, OUTPUT);
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(WATER_POWER_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(RELAY_PIN, LOW);

    pinMode(FLAME_DIGITAL_PIN, INPUT);
    pinMode(PIR_DIGITAL_PIN, INPUT);
    pinMode(GAS_ANALOG_PIN, INPUT);
    pinMode(WATER_ANALOG_PIN, INPUT);

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

    esp_task_wdt_init(30, true);
    esp_task_wdt_add(NULL);
    Serial.println("Watchdog: 30s timeout, panic mode enabled");

    initFlameGas();
    initPir();

    prefs.begin("robofusion", false);
    if (!prefs.isKey("seq_num")) {
        prefs.putUInt("seq_num", 1);
    }
    cacheInit();

    connectWiFi();
    initCommandServer();

    Serial.println("=== Boot complete ===\n");
}

static const uint32_t POLL_INTERVAL_MS = 500;

void loop() {
    handleCommandClient();
    ensureWiFiConnected();

    static uint32_t last_poll = 0;
    uint32_t now = millis();

    if (now - last_poll >= POLL_INTERVAL_MS) {
        last_poll = now;

        SensorReading flame = readFlame();
        SensorReading gas   = readGas();
        SensorReading pir   = readOccupancy();
        SensorReading water = readWater();

        Serial.printf("[%u] Flame=%s Gas=%.3f%s Occ=%s Water=%.2f Cache=%u\n",
                      now / 1000,
                      flame.normalized_value > 0.5f ? "FIRE" : "OK",
                      gas.normalized_value,
                      gas.valid ? "" : " (warming up)",
                      pir.normalized_value > 0.5f ? "PERSON" : "EMPTY",
                      water.normalized_value,
                      cacheCount());

        uint32_t seq = prefs.getUInt("seq_num", 1);
        prefs.putUInt("seq_num", seq + 1);

        if (isWiFiConnected()) {
            while (cacheCount() > 0) {
                CachedReading cached;
                cachePeekOldest(cached);
                bool ok = postReadings(ZONE_ID, cached.seq_num,
                                       cached.flame_val, cached.gas_val,
                                       cached.occ_val, cached.water_val);
                if (!ok) {
                    break;
                }
                cachePopOldest();
            }

            bool live_ok = postReadings(ZONE_ID, seq,
                                        flame.normalized_value,
                                        gas.normalized_value,
                                        pir.normalized_value,
                                        water.normalized_value);
            if (!live_ok) {
                cachePush(seq, flame.normalized_value,
                          gas.normalized_value,
                          pir.normalized_value,
                          water.normalized_value);
            }
        } else {
            cachePush(seq, flame.normalized_value,
                      gas.normalized_value,
                      pir.normalized_value,
                      water.normalized_value);
        }
    }

    esp_task_wdt_reset();
    delay(1);
}
