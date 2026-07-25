# Hardware BOM Checklist — RoboFusion 1.0

Per zone (start with 1 zone, expand later):

## Required per zone
- [ ] 1× ESP32 dev board (DevKit v1 style)
- [ ] 1× Flame sensor module (digital output)
- [ ] 1× MQ-2 gas sensor module (analog output)
- [ ] 1× HC-SR501 PIR motion sensor module
- [ ] 1× Conductive-strip water-level sensor module
- [ ] 1× Buzzer (active, 5V)
- [ ] 1× LED (any color) + 220Ω-330Ω resistor
- [ ] 1× Relay module (check for onboard flyback protection)
- [ ] 1× 1N4007 diode (if relay lacks flyback protection)
- [ ] 1× 100µF decoupling capacitor (for PIR)
- [ ] Breadboard + jumper wires

## Wiring notes (from Prompt 9)
- PIR gets its own 100µF cap across VCC/GND, placed ~2cm from module
- All output pins init LOW (safe on boot)
- ADC1 pins for analog sensors: GAS=34, WATER=35 (safe with WiFi)
