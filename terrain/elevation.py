import numpy as np
from noise import pnoise2

def generate_height_map(width, height, scale, octaves, persistence, lacunarity):
    """Generate a normalized height map using fractional Brownian motion.

    Parameters
    ----------
    width : int
        Width of the height map.
    height : int
        Height of the height map.
    scale : float
        Scaling factor for the noise. Values closer to zero produce more zoomed-in noise.
    octaves : int
        Number of noise octaves.
    persistence : float
        Amplitude multiplier for each octave.
    lacunarity : float
        Frequency multiplier for each octave.

    Returns
    -------
    np.ndarray
        A (height, width) array of floats normalized to the range [0, 1].
    """
    if scale <= 0:
        raise ValueError("scale must be greater than 0")

    height_map = np.zeros((height, width), dtype=np.float32)

    for y in range(height):
        for x in range(width):
            amplitude = 1.0
            frequency = 1.0
            noise_height = 0.0

            for _ in range(octaves):
                sample_x = x / scale * frequency
                sample_y = y / scale * frequency
                noise_value = pnoise2(sample_x, sample_y, repeatx=1024, repeaty=1024, base=0)
                noise_height += noise_value * amplitude

                amplitude *= persistence
                frequency *= lacunarity

            height_map[y, x] = noise_height

    min_val = height_map.min()
    max_val = height_map.max()
    if max_val - min_val == 0:
        return np.zeros_like(height_map)

    normalized_map = (height_map - min_val) / (max_val - min_val)
    return normalized_map
