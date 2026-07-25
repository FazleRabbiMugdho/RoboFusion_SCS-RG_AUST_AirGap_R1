#include <WiFi.h>
#include "wifi_manager.h"
#include "secrets.h"

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
