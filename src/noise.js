/**
 * Parameters:
 * - DEFAULT_OCTAVES: number — fallback octave count for fractal Brownian motion.
 * - DEFAULT_LACUNARITY: number — fallback lacunarity multiplier.
 * - DEFAULT_GAIN: number — fallback gain factor per octave.
 */
const DEFAULT_OCTAVES = 1;
const DEFAULT_LACUNARITY = 2.0;
const DEFAULT_GAIN = 0.5;

/**
 * Sample placeholder 2D noise.
 * @param {number} x
 * @param {number} y
 * @param {{octaves?: number, lacunarity?: number, gain?: number, frequency?: number}} [options]
 * @returns {number} A deterministic pseudo-noise value in the range [-1, 1].
 */
export function noise2D(x, y, options = {}) {
  void x;
  void y;
  void options;
  // TODO: Implement Mulberry32-based Simplex FBM noise sampler.
  return 0;
}

/**
 * Create a deterministic random number generator (stub).
 * @param {number} seed
 * @returns {() => number}
 */
export function createRng(seed) {
  void seed;
  // TODO: Replace with Mulberry32 or similar high-quality seeded RNG.
  return () => Math.random();
}
