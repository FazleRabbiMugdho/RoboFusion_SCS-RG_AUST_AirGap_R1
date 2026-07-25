#include "offline_cache.h"

static CachedReading buffer[OFFLINE_CACHE_CAPACITY];
static uint8_t head = 0;
static uint8_t tail = 0;
static uint8_t size = 0;

void cacheInit() {
    head = 0;
    tail = 0;
    size = 0;
}

bool cachePush(uint32_t seq_num, float flame_val, float gas_val,
               float occ_val, float water_val) {
    if (size == OFFLINE_CACHE_CAPACITY) {
        Serial.printf("[%lu] Cache full — dropping oldest seq=%u\n",
                      millis() / 1000, buffer[tail].seq_num);
        tail = (tail + 1) % OFFLINE_CACHE_CAPACITY;
        size--;
    }

    CachedReading &entry = buffer[head];
    entry.seq_num = seq_num;
    entry.flame_val = flame_val;
    entry.gas_val = gas_val;
    entry.occ_val = occ_val;
    entry.water_val = water_val;

    head = (head + 1) % OFFLINE_CACHE_CAPACITY;
    size++;
    return true;
}

bool cachePeekOldest(CachedReading &out) {
    if (size == 0) {
        return false;
    }
    out = buffer[tail];
    return true;
}

bool cachePopOldest() {
    if (size == 0) {
        return false;
    }
    tail = (tail + 1) % OFFLINE_CACHE_CAPACITY;
    size--;
    return true;
}

uint8_t cacheCount() {
    return size;
}

bool cacheIsFull() {
    return size >= OFFLINE_CACHE_CAPACITY;
}
