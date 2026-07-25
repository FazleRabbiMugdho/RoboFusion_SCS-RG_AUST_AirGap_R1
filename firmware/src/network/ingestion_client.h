#ifndef INGESTION_CLIENT_H
#define INGESTION_CLIENT_H

#include <Arduino.h>

#define INGESTION_TIMEOUT_MS 3000

bool postReadings(uint32_t zone_id, uint32_t seq_num,
                  float flame_val, float gas_val,
                  float occ_val, float water_val);

#endif
