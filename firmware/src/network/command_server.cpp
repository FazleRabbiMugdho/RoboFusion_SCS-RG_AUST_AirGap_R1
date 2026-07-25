#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include "command_server.h"
#include "secrets.h"
#include "actuators/actuators.h"

#define ZONE_COMMAND_PORT 8080

static WebServer server(ZONE_COMMAND_PORT);

// Constant-time comparison: full fixed-length byte compare,
// no short-circuit exit (avoids timing side-channel).
static bool secure_key_match(const String &header_key) {
    const char *expected = ZONE_API_KEY;
    size_t expected_len = strlen(expected);
    size_t header_len = header_key.length();

    if (header_len != expected_len) {
        return false;
    }

    volatile uint8_t result = 0;
    for (size_t i = 0; i < expected_len; i++) {
        result |= (uint8_t)(header_key[i] ^ expected[i]);
    }
    return result == 0;
}

static void handleCommandPost() {
    // Auth check
    if (!server.hasHeader("X-Zone-Api-Key")) {
        server.send(401, "application/json", "{\"status\":\"unauthorized\"}");
        Serial.printf("[%lu] Command rejected: missing X-Zone-Api-Key\n", millis() / 1000);
        return;
    }

    String api_key = server.header("X-Zone-Api-Key");
    if (!secure_key_match(api_key)) {
        server.send(401, "application/json", "{\"status\":\"unauthorized\"}");
        Serial.printf("[%lu] Command rejected: invalid X-Zone-Api-Key\n", millis() / 1000);
        return;
    }

    // Parse JSON body
    StaticJsonDocument<128> doc;
    DeserializationError err = deserializeJson(doc, server.arg("plain"));
    if (err) {
        server.send(400, "application/json", "{\"status\":\"bad_request\"}");
        Serial.printf("[%lu] Command rejected: invalid JSON\n", millis() / 1000);
        return;
    }

    bool buzzer = doc["buzzer"] | false;
    bool led    = doc["led"]    | false;
    bool relay  = doc["relay"]  | false;

    activateBuzzer(buzzer);
    activateLED(led);
    activateRelay(relay);

    server.send(200, "application/json", "{\"status\":\"ok\"}");
    Serial.printf("[%lu] Command accepted: buzzer=%d led=%d relay=%d\n",
                  millis() / 1000, buzzer, led, relay);
}

void initCommandServer() {
    server.on("/command", HTTP_POST, handleCommandPost);
    server.begin();
    Serial.printf("Command server listening on port %d\n", ZONE_COMMAND_PORT);
}

void handleCommandClient() {
    server.handleClient();
}
