#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>

#define RECONNECT_BASE_MS 1000
#define RECONNECT_MAX_MS  30000

void connectWiFi();
bool isWiFiConnected();
void ensureWiFiConnected();

#endif
