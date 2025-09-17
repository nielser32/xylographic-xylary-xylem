/**
 * Parameters:
 * - GRID_WIDTH: number — placeholder width used when no explicit size is provided.
 * - GRID_HEIGHT: number — placeholder height used when no explicit size is provided.
 */
const GRID_WIDTH = 512;
const GRID_HEIGHT = 512;

/**
 * Generate terrain elevation samples for a world map.
 * @param {number} [width=GRID_WIDTH]
 * @param {number} [height=GRID_HEIGHT]
 * @param {string|number} [seed]
 * @returns {Float32Array} Elevation values in meters.
 */
export function makeElevation(width = GRID_WIDTH, height = GRID_HEIGHT, seed) {
  void seed; // Seeded noise will be added by later agents.
  // TODO: Replace placeholder array with deterministic elevation synthesis.
  return new Float32Array(width * height);
}
