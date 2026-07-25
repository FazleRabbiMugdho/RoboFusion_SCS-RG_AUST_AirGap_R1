#ifndef OFFLINE_CACHE_H
#define OFFLINE_CACHE_H

#include <Arduino.h>

#define OFFLINE_CACHE_CAPACITY 60

struct CachedReading {
    uint32_t seq_num;
    float flame_val;
    float gas_val;
    float occ_val;
    float water_val;
};

void cacheInit();
bool cachePush(uint32_t seq_num, float flame_val, float gas_val,
               float occ_val, float water_val);
bool cachePeekOldest(CachedReading &out);
bool cachePopOldest();
uint8_t cacheCount();
bool cacheIsFull();

#endif
