import numpy as np
from noise import pnoise2


def _generate_noise_map(height_map, scale: float, seed: int) -> np.ndarray:
    """Generate a normalized noise map matching the resolution of ``height_map``."""
    if scale <= 0:
        raise ValueError("scale must be greater than 0")

    height, width = height_map.shape
    noise_map = np.zeros((height, width), dtype=np.float32)

    for y in range(height):
        for x in range(width):
            sample_x = x / scale
            sample_y = y / scale
            noise_value = pnoise2(sample_x, sample_y, repeatx=1024, repeaty=1024, base=seed)
            noise_map[y, x] = (noise_value + 1.0) / 2.0

    return noise_map


def generate_moisture_map(height_map: np.ndarray, scale: float = 100.0, seed: int = 42) -> np.ndarray:
    """Generate a moisture map aligned with the given ``height_map``."""
    return _generate_noise_map(height_map, scale, seed)


def generate_temperature_map(height_map: np.ndarray, scale: float = 150.0, seed: int = 24) -> np.ndarray:
    """Generate a temperature map aligned with the given ``height_map``."""
    return _generate_noise_map(height_map, scale, seed)
