"""Utilities for mapping biomes to colors and interpolating between them."""

from __future__ import annotations

from typing import Dict, Tuple

import numpy as np

# Base RGB colors for common biomes.
BIOME_BASE_COLORS: Dict[str, Tuple[int, int, int]] = {
    "ocean": (0, 105, 148),
    "beach": (238, 214, 175),
    "forest": (34, 139, 34),
    "grassland": (124, 252, 0),
    "desert": (210, 180, 140),
    "tundra": (176, 196, 222),
    "snow": (255, 250, 250),
    "mountain": (139, 137, 137),
    "swamp": (47, 79, 79),
}


def biome_color_map(biome_grid: np.ndarray) -> np.ndarray:
    """Convert a grid of biome names to an RGB color grid.

    Parameters
    ----------
    biome_grid:
        Two-dimensional array of biome identifiers.

    Returns
    -------
    numpy.ndarray
        Array of shape ``(H, W, 3)`` containing the base RGB colors for each
        biome cell.
    """
    height, width = biome_grid.shape
    color_grid = np.zeros((height, width, 3), dtype=np.float32)
    for y in range(height):
        for x in range(width):
            biome = biome_grid[y, x]
            color_grid[y, x] = BIOME_BASE_COLORS.get(biome, (0, 0, 0))
    return color_grid


def bilinear_interpolate(color_grid: np.ndarray, scale: int = 4) -> np.ndarray:
    """Upscale ``color_grid`` using bilinear interpolation.

    Parameters
    ----------
    color_grid:
        Array of shape ``(H, W, 3)`` representing the color of each biome cell.
    scale:
        Upscaling factor. Values greater than one will interpolate between
        neighboring cells. A value of ``1`` returns the original grid.

    Returns
    -------
    numpy.ndarray
        Interpolated color map of shape ``(H*scale, W*scale, 3)``.
    """
    if scale <= 1:
        return color_grid.astype(np.uint8)

    height, width, _ = color_grid.shape
    new_h = height * scale
    new_w = width * scale

    ys = np.linspace(0, height - 1, new_h)
    xs = np.linspace(0, width - 1, new_w)
    output = np.zeros((new_h, new_w, 3), dtype=np.float32)

    for i, y in enumerate(ys):
        y0 = int(np.floor(y))
        y1 = min(y0 + 1, height - 1)
        y_lerp = y - y0
        for j, x in enumerate(xs):
            x0 = int(np.floor(x))
            x1 = min(x0 + 1, width - 1)
            x_lerp = x - x0

            top = (1 - x_lerp) * color_grid[y0, x0] + x_lerp * color_grid[y0, x1]
            bottom = (1 - x_lerp) * color_grid[y1, x0] + x_lerp * color_grid[y1, x1]
            output[i, j] = (1 - y_lerp) * top + y_lerp * bottom

    return output.astype(np.uint8)


__all__ = ["BIOME_BASE_COLORS", "biome_color_map", "bilinear_interpolate"]
