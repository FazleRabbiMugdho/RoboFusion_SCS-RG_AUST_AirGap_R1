#include "camera_motion.h"
#include "pins.h"
#include <esp_camera.h>
#include <esp_heap_caps.h>

// Camera configuration for ESP32-CAM (AI Thinker)
#define CAMERA_FRAME_SIZE FRAMESIZE_QQVGA  // 160x120
#define CAMERA_PIXEL_FORMAT PIXFORMAT_GRAYSCALE

// Frame buffer pointers
static camera_fb_t* prev_frame = nullptr;
static camera_fb_t* curr_frame = nullptr;

// Motion threshold for change detection
static const float MOTION_SENSITIVITY = 0.03f;  // Match backend CAMERA_MOTION_THRESHOLD

bool init_camera() {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = 5;
    config.pin_d1 = 18;
    config.pin_d2 = 19;
    config.pin_d3 = 21;
    config.pin_d4 = 36;
    config.pin_d5 = 39;
    config.pin_d6 = 34;
    config.pin_d7 = 35;
    config.pin_xclk = 0;
    config.pin_pclk = 22;
    config.pin_vsync = 25;
    config.pin_href = 23;
    config.pin_sccb_sda = 26;
    config.pin_sccb_scl = 27;
    config.pin_pwdn = 32;
    config.pin_reset = -1;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = CAMERA_PIXEL_FORMAT;
    config.frame_size = CAMERA_FRAME_SIZE;
    config.jpeg_quality = 10;
    config.fb_count = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("Camera init failed: 0x%x\n", err);
        return false;
    }

    // Get initial frame for reference
    prev_frame = esp_camera_fb_get();
    if (!prev_frame) {
        Serial.println("Failed to get initial frame");
        return false;
    }

    // Return first frame so next capture gives us a diff
    esp_camera_fb_return(prev_frame);
    prev_frame = esp_camera_fb_get();
    if (!prev_frame) {
        Serial.println("Failed to get second frame");
        return false;
    }

    return true;
}

void initCameraMotion() {
    Serial.println("Initializing ESP32-CAM for motion detection...");

    if (!init_camera()) {
        Serial.println("ERROR: Camera initialization failed!");
        return;
    }

    Serial.println("Camera initialized successfully");
    Serial.printf("Frame size: %dx%d, Format: %s\n",
                  160, 120, "GRAYSCALE");
}

CameraMotionReading readCameraMotion() {
    CameraMotionReading reading;
    reading.motion_score = 0.0f;
    reading.valid = false;

    // Capture current frame
    curr_frame = esp_camera_fb_get();
    if (!curr_frame) {
        Serial.println("Failed to capture frame");
        return reading;
    }

    if (!prev_frame) {
        // First frame - no previous to compare
        prev_frame = curr_frame;
        return reading;
    }

    // Both frames should be same size
    if (curr_frame->len != prev_frame->len) {
        Serial.println("Frame size mismatch");
        esp_camera_fb_return(curr_frame);
        return reading;
    }

    // Compute frame difference (sum of absolute differences)
    uint32_t sum_diff = 0;
    const uint8_t* curr_buf = curr_frame->buf;
    const uint8_t* prev_buf = prev_frame->buf;
    const size_t frame_size = curr_frame->len;

    for (size_t i = 0; i < frame_size; i++) {
        uint8_t diff = (curr_buf[i] > prev_buf[i]) ?
                       (curr_buf[i] - prev_buf[i]) :
                       (prev_buf[i] - curr_buf[i]);
        sum_diff += diff;
    }

    // Normalize to 0.0-1.0: max possible diff is 255 per pixel
    // 160 * 120 = 19200 pixels
    float max_possible = frame_size * 255.0f;
    float score = (float)sum_diff / max_possible;

    // Clamp to [0.0, 1.0]
    if (score > 1.0f) score = 1.0f;
    if (score < 0.0f) score = 0.0f;

    reading.motion_score = score;
    reading.valid = true;

    // Return previous frame, keep current as new previous
    esp_camera_fb_return(prev_frame);
    prev_frame = curr_frame;

    return reading;
}