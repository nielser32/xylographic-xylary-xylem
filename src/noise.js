/**
 * Parameters:
 * - DEFAULT_OCTAVES: number — fallback octave count for fractal Brownian motion.
 * - DEFAULT_LACUNARITY: number — fallback lacunarity multiplier.
 * - DEFAULT_GAIN: number — fallback gain factor per octave.
 * - DEFAULT_FREQUENCY: number — fallback base frequency in world units.
 */
const DEFAULT_OCTAVES = 6;
const DEFAULT_LACUNARITY = 2.0;
const DEFAULT_GAIN = 0.5;
const DEFAULT_FREQUENCY = 0.0015;

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
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

const permutationCache = new Map();

/**
 * Sample deterministic 2D Simplex FBM noise.
 * Consecutive calls with the same parameters always produce the same result.
 *
 * @param {number} x
 * @param {number} y
 * @param {{octaves?: number, lacunarity?: number, gain?: number, frequency?: number, seed?: string|number}} [options]
 * @returns {number} A deterministic pseudo-noise value in the range [-1, 1].
 */
export function noise2D(x, y, options = {}) {
  const {
    octaves = DEFAULT_OCTAVES,
    lacunarity = DEFAULT_LACUNARITY,
    gain = DEFAULT_GAIN,
    frequency = DEFAULT_FREQUENCY,
    seed = 'default',
  } = options;

  const octaveCount = Math.max(1, Math.floor(Number.isFinite(octaves) ? octaves : DEFAULT_OCTAVES));
  const lacunaritySafe = Number.isFinite(lacunarity) && lacunarity !== 0 ? lacunarity : DEFAULT_LACUNARITY;
  const gainSafe = Number.isFinite(gain) ? gain : DEFAULT_GAIN;
  const baseFrequency = Math.abs(Number.isFinite(frequency) && frequency > 0 ? frequency : DEFAULT_FREQUENCY);

  const perm = getPermutation(seed);

  let amplitude = 1;
  let total = 0;
  let normalization = 0;
  let octaveFrequency = baseFrequency;

  for (let octave = 0; octave < octaveCount; octave += 1) {
    const sample = simplex2D(x * octaveFrequency, y * octaveFrequency, perm);
    total += sample * amplitude;
    normalization += amplitude;

    amplitude *= gainSafe;
    octaveFrequency *= lacunaritySafe;

    if (!Number.isFinite(amplitude) || amplitude <= 0) {
      break;
    }
  }

  if (normalization === 0) {
    return 0;
  }

  const value = total / normalization;
  if (value > 1) return 1;
  if (value < -1) return -1;
  return value;
}

/**
 * Create a deterministic random number generator based on Mulberry32.
 * Example usage:
 * const rngA = createRng('demo-seed');
 * const rngB = createRng('demo-seed');
 * rngA() === rngB(); // always true for the same invocation count.
 *
 * @param {number|string} seed
 * @returns {() => number}
 */
export function createRng(seed) {
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getPermutation(seed) {
  const key = String(seed ?? 'default');
  if (permutationCache.has(key)) {
    return permutationCache.get(key);
  }

  const base = buildPermutation(normalizeSeed(key));
  permutationCache.set(key, base);
  return base;
}

function buildPermutation(seed) {
  const source = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) {
    source[i] = i;
  }

  const rng = createRng(seed);
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = source[i];
    source[i] = source[j];
    source[j] = temp;
  }

  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i += 1) {
    perm[i] = source[i & 255];
  }
  return perm;
}

function simplex2D(x, y, perm) {
  let n0 = 0;
  let n1 = 0;
  let n2 = 0;

  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const x0 = x - (i - t);
  const y0 = y - (j - t);

  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    t0 *= t0;
    const grad0 = GRADIENTS[perm[ii + perm[jj]] % GRADIENTS.length];
    n0 = t0 * t0 * (grad0[0] * x0 + grad0[1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    t1 *= t1;
    const grad1 = GRADIENTS[perm[ii + i1 + perm[jj + j1]] % GRADIENTS.length];
    n1 = t1 * t1 * (grad1[0] * x1 + grad1[1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    t2 *= t2;
    const grad2 = GRADIENTS[perm[ii + 1 + perm[jj + 1]] % GRADIENTS.length];
    n2 = t2 * t2 * (grad2[0] * x2 + grad2[1] * y2);
  }

  return 70 * (n0 + n1 + n2);
}

function normalizeSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  const text = String(seed ?? '');
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
