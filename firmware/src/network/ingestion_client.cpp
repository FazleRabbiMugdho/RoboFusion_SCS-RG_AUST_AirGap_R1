#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "ingestion_client.h"
#include "secrets.h"

bool postReadings(uint32_t zone_id, uint32_t seq_num,
                  float flame_val, float gas_val,
                  float occ_val, float water_val) {
    if (!WiFi.isConnected()) {
        return false;
    }

    HTTPClient http;
    String url = "http://";
    url += BACKEND_HOST;
    url += ":";
    url += BACKEND_PORT;
    url += "/api/v1/zones/";
    url += zone_id;
    url += "/readings";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Zone-Api-Key", ZONE_API_KEY);

    StaticJsonDocument<256> doc;
    doc["zone_id"] = zone_id;
    doc["seq_num"] = seq_num;

    JsonArray readings = doc.createNestedArray("readings");

    JsonObject r1 = readings.createNestedObject();
    r1["hazard_type"] = "FLAME";
    r1["raw_value"] = flame_val;

    JsonObject r2 = readings.createNestedObject();
    r2["hazard_type"] = "GAS";
    r2["raw_value"] = gas_val;

    JsonObject r3 = readings.createNestedObject();
    r3["hazard_type"] = "OCCUPANCY";
    r3["raw_value"] = occ_val;

    JsonObject r4 = readings.createNestedObject();
    r4["hazard_type"] = "WATER";
    r4["raw_value"] = water_val;

    String body;
    serializeJson(doc, body);

    http.setTimeout(INGESTION_TIMEOUT_MS);
    int status = http.POST(body);
    http.end();

    if (status == 200) {
        Serial.printf("[%lu] POST ok seq=%u\n", millis() / 1000, seq_num);
        return true;
    }

    Serial.printf("[%lu] POST failed seq=%u status=%d\n", millis() / 1000, seq_num, status);
    return false;
}
