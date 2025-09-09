"""Shading utilities for blending elevation-based lighting with biome colors."""

from __future__ import annotations

from typing import Tuple

import numpy as np


def compute_shading(
    height_map: np.ndarray, light_dir: Tuple[float, float, float] = (-1.0, -1.0, 1.0)
) -> np.ndarray:
    """Return a normalized shading mask derived from ``height_map``.

    The slope at each cell is estimated from the gradient of the height map and
    compared with ``light_dir`` to simulate light and shadow.

    Parameters
    ----------
    height_map:
        Two-dimensional array of normalized elevation values.
    light_dir:
        ``(x, y, z)`` tuple indicating the direction from which light originates.
        The vector is normalized internally.

    Returns
    -------
    numpy.ndarray
        Array of shape ``(H, W)`` with values in the range ``[0, 1]`` representing
        light intensity for each cell.
    """
    # Gradient in y and x directions
    gy, gx = np.gradient(height_map)
    # Construct surface normals
    normals = np.dstack((-gx, -gy, np.ones_like(height_map)))
    # Normalize normals
    norms = np.linalg.norm(normals, axis=2, keepdims=True)
    normals /= np.maximum(norms, 1e-8)

    # Normalize light direction
    light = np.asarray(light_dir, dtype=np.float32)
    light /= np.linalg.norm(light)

    # Dot product between normals and light direction
    shading = np.clip(normals @ light, 0.0, 1.0)
    return shading.squeeze()


def blend_shading(
    biome_colors: np.ndarray, shading: np.ndarray, strength: float = 0.6
) -> np.ndarray:
    """Blend ``shading`` with ``biome_colors`` for a hand-painted appearance.

    Parameters
    ----------
    biome_colors:
        Array of shape ``(H, W, 3)`` containing base RGB colors for each cell.
    shading:
        Array of shape ``(H, W)`` with values in ``[0, 1]`` produced by
        :func:`compute_shading`.
    strength:
        How strongly the shading influences the colors. A value of ``0`` keeps
        the original colors, while ``1`` applies full shading.

    Returns
    -------
    numpy.ndarray
        Shaded color map of shape ``(H, W, 3)``.
    """
    shading = np.clip(shading, 0.0, 1.0)
    shade_factor = (1 - strength) + strength * shading
    shaded = biome_colors.astype(np.float32) * shade_factor[..., None]
    return shaded.clip(0, 255).astype(np.uint8)


__all__ = ["compute_shading", "blend_shading"]
