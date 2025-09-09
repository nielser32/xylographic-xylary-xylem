"""Rendering utilities for terrain maps."""

from .biome_colors import BIOME_BASE_COLORS, biome_color_map, bilinear_interpolate
from .shading import compute_shading, blend_shading

__all__ = [
    "BIOME_BASE_COLORS",
    "biome_color_map",
    "bilinear_interpolate",
    "compute_shading",
    "blend_shading",
]
