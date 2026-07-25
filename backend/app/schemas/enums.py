from enum import Enum


class HazardType(str, Enum):
    FLAME = "FLAME"
    GAS = "GAS"
    WATER = "WATER"
    OCCUPANCY = "OCCUPANCY"

class ZoneState(str, Enum):
    SAFE = "SAFE"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"

class LabType(str, Enum):
    IOT_LAB = "IOT_LAB"
    ROBOTICS_LAB = "ROBOTICS_LAB"
    SERVER_ROOM = "SERVER_ROOM"
    DATA_SCIENCE_LAB = "DATA_SCIENCE_LAB"
    SOFTWARE_LAB = "SOFTWARE_LAB"

class Role(str, Enum):
    STAFF = "STAFF"
    ADMIN = "ADMIN"
