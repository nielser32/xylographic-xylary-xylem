import { noise2D } from './noise.js';

/**
 * Parameters:
 * - GRID_WIDTH: number — default world width in cells when none provided.
 * - GRID_HEIGHT: number — default world height in cells when none provided.
 * - DEFAULT_ELEVATION_OPTS: object — fallback FBM configuration for elevation.
 */
const GRID_WIDTH = 512;
const GRID_HEIGHT = 512;
const DEFAULT_ELEVATION_OPTS = {
  octaves: 6,
  lacunarity: 2,
  gain: 0.5,
  frequency: 0.003,
};

/**
 * Generate terrain elevation samples for a world map.
 * @param {number} [width=GRID_WIDTH]
 * @param {number} [height=GRID_HEIGHT]
 * @param {string|number} [seed]
 * @param {{octaves?: number, lacunarity?: number, gain?: number, frequency?: number}} [opts]
 * @returns {Float32Array & {length: number}} Elevation values normalized to [0, 1].
 */
export function makeElevation(width = GRID_WIDTH, height = GRID_HEIGHT, seed, opts = {}) {
  const w = Math.max(1, Math.floor(Number.isFinite(width) ? width : GRID_WIDTH));
  const h = Math.max(1, Math.floor(Number.isFinite(height) ? height : GRID_HEIGHT));
  const {
    octaves = DEFAULT_ELEVATION_OPTS.octaves,
    lacunarity = DEFAULT_ELEVATION_OPTS.lacunarity,
    gain = DEFAULT_ELEVATION_OPTS.gain,
    frequency = DEFAULT_ELEVATION_OPTS.frequency,
  } = opts;

  const elev = new Float32Array(w * h);
  const invW = w > 1 ? 1 / (w - 1) : 0;
  const invH = h > 1 ? 1 / (h - 1) : 0;

  for (let j = 0; j < h; j += 1) {
    const ny = j * invH;
    for (let i = 0; i < w; i += 1) {
      const nx = i * invW;
      const fbm = noise2D(i, j, { seed, octaves, lacunarity, gain, frequency });
      const mask = continentalMask(nx, ny);
      const masked = clamp01(((fbm + 1) * 0.5) * mask);
      elev[j * w + i] = masked;
    }
  }

  return elev;
}

function continentalMask(nx, ny) {
  const cx = nx * 2 - 1;
  const cy = ny * 2 - 1;
  const distance = Math.sqrt(cx * cx + cy * cy);
  const radial = 1 - smoothstep(0.45, 1.05, distance);
  const latBand = 1 - smoothstep(0.25, 0.95, Math.abs(cy));
  const coast = smoothstep(0.0, 0.8, radial);
  const mask = coast * (0.65 + 0.35 * latBand);
  return clamp01(Math.pow(mask, 1.15));
}

function smoothstep(edge0, edge1, x) {
  if (edge0 === edge1) {
    return x < edge0 ? 0 : 1;
  }
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
