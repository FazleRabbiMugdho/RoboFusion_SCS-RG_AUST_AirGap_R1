#include <WiFi.h>
#include "wifi_manager.h"
#include "secrets.h"

static unsigned long last_reconnect_attempt = 0;
static unsigned long current_backoff = RECONNECT_BASE_MS;

void connectWiFi() {
    Serial.print("Connecting to WiFi");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > 15000) {
            Serial.println("\nWiFi connection timeout (15s)");
            break;
        }
        Serial.print(".");
        delay(500);
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\nWiFi connected. IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("WiFi failed to connect — continuing without network");
    }
}

bool isWiFiConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void ensureWiFiConnected() {
    if (isWiFiConnected()) {
        current_backoff = RECONNECT_BASE_MS;
        return;
    }

    unsigned long now = millis();
    if (now - last_reconnect_attempt < current_backoff) {
        return;
    }

    last_reconnect_attempt = now;
    Serial.printf("[%lu] WiFi reconnecting (backoff=%ums)...\n", now / 1000, current_backoff);
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    if (isWiFiConnected()) {
        Serial.printf("[%lu] WiFi reconnected. IP: %s\n", now / 1000, WiFi.localIP().toString().c_str());
        current_backoff = RECONNECT_BASE_MS;
    } else {
        current_backoff = min(current_backoff * 2, RECONNECT_MAX_MS);
    }
}
