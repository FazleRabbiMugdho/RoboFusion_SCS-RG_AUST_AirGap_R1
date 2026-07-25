#ifndef FLAME_GAS_H
#define FLAME_GAS_H

#include <Arduino.h>

struct SensorReading {
  float normalized_value;
  bool valid;
};

SensorReading readFlame();
SensorReading readGas();
void initFlameGas();

#endif
