#include <Arduino.h>
#include <Preferences.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "esp_task_wdt.h"
#include "pins.h"
#include "sensors/camera_motion.h"
#include "network/wifi_manager.h"
#include "secrets.h"

// ESP32-CAM uses different pins for camera - these are board-specific
// AI Thinker ESP32-CAM pinout is hardcoded in camera_motion.cpp

static Preferences prefs;

void setup() {
    Serial.begin(115200);
    delay(100);

    Serial.println();
    Serial.println("=== RoboFusion 1.0 ESP32-CAM Motion Cross-Check Boot ===");

    // Watchdog
    esp_task_wdt_init(30, true);
    esp_task_wdt_add(NULL);
    Serial.println("Watchdog: 30s timeout, panic mode enabled");

    // Initialize NVS for sequence persistence
    prefs.begin("robofusion", false);
    if (!prefs.isKey("camera_seq_num")) {
        prefs.putUInt("camera_seq_num", 1);
        Serial.println("Initialized camera_seq_num = 1");
    }

    // Initialize camera
    initCameraMotion();

    // Connect WiFi
    connectWiFi();

    Serial.println("=== ESP32-CAM Boot complete ===\n");
}

// POST interval: 2000ms as specified
static const uint32_t CAMERA_POST_INTERVAL_MS = 2000;
static const uint32_t INGESTION_TIMEOUT_MS = 3000;

void loop() {
    ensureWiFiConnected();
    esp_task_wdt_reset();

    static uint32_t last_post = 0;
    uint32_t now = millis();

    if (now - last_post >= CAMERA_POST_INTERVAL_MS) {
        last_post = now;

        CameraMotionReading reading = readCameraMotion();

        if (reading.valid) {
            uint32_t seq = prefs.getUInt("camera_seq_num", 1);

            // Build JSON payload
            StaticJsonDocument<128> doc;
            doc["motion_score"] = reading.motion_score;
            doc["seq_num"] = seq;

            String body;
            serializeJson(doc, body);

            // POST to backend
            if (WiFi.isConnected()) {
                HTTPClient http;
                String url = "http://";
                url += BACKEND_HOST;
                url += ":";
                url += BACKEND_PORT;
                url += "/api/v1/zones/";
                url += ZONE_ID;
                url += "/camera-motion";

                http.begin(url);
                http.setTimeout(INGESTION_TIMEOUT_MS);
                http.addHeader("Content-Type", "application/json");
                http.addHeader("X-Zone-Api-Key", ZONE_API_KEY);

                int status = http.POST(body);

                if (status == 200) {
                    Serial.printf("[%lu] Camera POST ok seq=%u motion=%.4f\n",
                                  now / 1000, seq, reading.motion_score);
                    prefs.putUInt("camera_seq_num", seq + 1);
                } else {
                    Serial.printf("[%lu] Camera POST failed seq=%u status=%d\n",
                                  now / 1000, seq, status);
                    // On 409 (duplicate), don't increment seq - let it retry
                    // On other errors, we could implement retry logic
                }
                http.end();
            }
        } else {
            Serial.println("Camera read invalid, skipping POST");
        }
    }

    // Small delay to yield to other tasks
    delay(1);
}