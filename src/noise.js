/**
 * Parameters:
 * - DEFAULT_OCTAVES: number — fallback octave count for fractal Brownian motion.
 * - DEFAULT_LACUNARITY: number — fallback lacunarity multiplier between octaves.
 * - DEFAULT_GAIN: number — fallback gain factor per octave.
 * - DEFAULT_FREQUENCY: number — fallback base frequency applied to input coordinates.
 */
const DEFAULT_OCTAVES = 6;
const DEFAULT_LACUNARITY = 2.0;
const DEFAULT_GAIN = 0.5;
const DEFAULT_FREQUENCY = 0.0015;

const PERMUTATION_CACHE = new Map();

const GRADIENTS = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [0, 1],
  [0, -1],
];

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

/**
 * Create a deterministic random number generator based on Mulberry32.
 * @param {number|string} seed
 * @returns {() => number} Function that yields floats on [0, 1).
 */
export function createRng(seed) {
  let state = normalizeSeed(seed);
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample 2D simplex fractal Brownian motion noise.
 * Example:
 * ```js
 * noise2D(12.5, 64.25, { seed: 42 }) === noise2D(12.5, 64.25, { seed: 42 });
 * ```
 *
 * @param {number} x
 * @param {number} y
 * @param {{
 *   seed?: number|string,
 *   octaves?: number,
 *   lacunarity?: number,
 *   gain?: number,
 *   frequency?: number,
 * }} [options]
 * @returns {number} Deterministic sample in the range [-1, 1].
 */
export function noise2D(x, y, options = {}) {
  const {
    seed = 0,
    octaves = DEFAULT_OCTAVES,
    lacunarity = DEFAULT_LACUNARITY,
    gain = DEFAULT_GAIN,
    frequency = DEFAULT_FREQUENCY,
  } = options;

  const perm = getPermutationTable(seed);
  let amp = 1;
  let freq = frequency;
  let amplitudeSum = 0;
  let noiseSum = 0;

  const octaveCount = Math.max(1, Math.floor(octaves));
  for (let octave = 0; octave < octaveCount; octave += 1) {
    noiseSum += amp * simplex2(x * freq, y * freq, perm);
    amplitudeSum += amp;
    amp *= gain;
    freq *= lacunarity;
  }

  if (amplitudeSum === 0) {
    return 0;
  }

  return clamp(noiseSum / amplitudeSum, -1, 1);
}

function simplex2(xin, yin, perm) {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = xin - X0;
  const y0 = yin - Y0;

  let i1;
  let j1;
  if (x0 > y0) {
    i1 = 1;
    j1 = 0;
  } else {
    i1 = 0;
    j1 = 1;
  }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;
  const gi0 = perm[ii + perm[jj]] % 12;
  const gi1 = perm[ii + i1 + perm[jj + j1]] % 12;
  const gi2 = perm[ii + 1 + perm[jj + 1]] % 12;

  let n0 = 0;
  let n1 = 0;
  let n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    const g = GRADIENTS[gi0];
    n0 = t0 * t0 * (g[0] * x0 + g[1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    const g = GRADIENTS[gi1];
    n1 = t1 * t1 * (g[0] * x1 + g[1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    const g = GRADIENTS[gi2];
    n2 = t2 * t2 * (g[0] * x2 + g[1] * y2);
  }

  // Scale the sum to cover roughly [-1, 1].
  return 70 * (n0 + n1 + n2);
}

function getPermutationTable(seed) {
  const key = normalizeSeed(seed);
  if (PERMUTATION_CACHE.has(key)) {
    return PERMUTATION_CACHE.get(key);
  }

  const rng = createRng(key);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) {
    base[i] = i;
  }
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = base[i];
    base[i] = base[j];
    base[j] = swap;
  }

  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i += 1) {
    perm[i] = base[i & 255];
  }

  PERMUTATION_CACHE.set(key, perm);
  return perm;
}

function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }
  const str = String(seed ?? '0');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
