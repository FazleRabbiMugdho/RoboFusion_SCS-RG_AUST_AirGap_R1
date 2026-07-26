FEATURE_ORDER = ["fire_norm", "gas_norm", "water_norm", "occupied"]


def extract_feature_vector(
    fire_norm: float,
    gas_norm: float,
    water_norm: float,
    occupied: bool,
) -> list[float]:
    return [fire_norm, gas_norm, water_norm, 1.0 if occupied else 0.0]