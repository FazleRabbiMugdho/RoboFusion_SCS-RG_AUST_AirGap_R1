#ifndef CAMERA_MOTION_H
#define CAMERA_MOTION_H

#include <Arduino.h>

// Camera motion sensor reading
struct CameraMotionReading {
    float motion_score;  // 0.0 to 1.0
    bool valid;
};

// Initialize camera motion sensor
void initCameraMotion();

// Read motion score from frame difference
CameraMotionReading readCameraMotion();

#endif  // CAMERA_MOTION_H