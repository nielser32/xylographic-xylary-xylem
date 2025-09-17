/**
 * Parameters:
 * - COLOR_LUT: Uint8 RGBA tuples — placeholder biome colors chosen for color-blind safety.
 * - TILE_WORLD_SIZE: number — world-space size of the synthetic tile cells in CSS pixels.
 * - BIOME_BAND_HEIGHT: number — vertical span controlling broad color bands for variation.
 * - AXIS_COLOR: string — color of the origin crosshair overlay.
 */
const COLOR_LUT = [
  [12, 24, 48, 255], // deep ocean
  [20, 54, 88, 255], // ocean shelf
  [34, 96, 120, 255], // shallow water
  [56, 110, 72, 255], // coastal wetland
  [100, 140, 78, 255], // temperate forest
  [160, 142, 68, 255], // savanna/grassland
  [186, 114, 94, 255], // arid shrubland
  [220, 216, 200, 255], // alpine/snow
];

const TILE_WORLD_SIZE = 48;
const BIOME_BAND_HEIGHT = TILE_WORLD_SIZE * 3;
const AXIS_COLOR = 'rgba(255, 255, 255, 0.18)';

let cachedImageData = null;
let cachedWidth = 0;
let cachedHeight = 0;

/**
 * Draw the current frame onto the provided rendering context.
 * @param {object} state - Global application state snapshot.
 * @param {object} view - Rendering parameters.
 * @param {CanvasRenderingContext2D} view.context
 * @param {number} view.pixelRatio
 * @param {number} view.width - Canvas width in device pixels.
 * @param {number} view.height - Canvas height in device pixels.
 */
export function draw(state, view) {
  const { context: ctx, pixelRatio, width, height } = view;
  if (!ctx) return;

  const imageData = ensureImageData(ctx, width, height);
  rasterize(imageData, state, pixelRatio || 1);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(imageData, 0, 0);
  ctx.restore();

  const cssWidth = width / (pixelRatio || 1);
  const cssHeight = height / (pixelRatio || 1);

  ctx.save();
  ctx.setTransform(pixelRatio || 1, 0, 0, pixelRatio || 1, 0, 0);
  drawAxes(ctx, {
    viewportWidth: cssWidth,
    viewportHeight: cssHeight,
    panX: state?.view?.panX || 0,
    panY: state?.view?.panY || 0,
    zoom: state?.view?.zoom || 1,
    pixelRatio: pixelRatio || 1,
  });
  ctx.restore();
}

function ensureImageData(ctx, width, height) {
  if (!cachedImageData || cachedWidth !== width || cachedHeight !== height) {
    cachedWidth = width;
    cachedHeight = height;
    cachedImageData = ctx.createImageData(width, height);
  }
  return cachedImageData;
}

function rasterize(imageData, state, pixelRatio) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  const view = state?.view || {};
  const zoom = Math.max(view.zoom || 1, Number.EPSILON);
  const panX = view.panX || 0;
  const panY = view.panY || 0;
  const invPixelRatio = 1 / pixelRatio;
  const seedHash = hashSeed(String(state?.seed ?? ''));

  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    const cssY = y * invPixelRatio;
    const worldY = (cssY - panY) / zoom;
    const cellY = Math.floor(worldY / TILE_WORLD_SIZE);

    let cssX = 0;
    for (let x = 0; x < width; x += 1) {
      const worldX = (cssX - panX) / zoom;
      const cellX = Math.floor(worldX / TILE_WORLD_SIZE);
      const colorIndex = sampleColorIndex(cellX, cellY, worldX, worldY, seedHash);
      const color = COLOR_LUT[colorIndex];

      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = color[3];
      offset += 4;

      cssX += invPixelRatio;
    }
  }
}

function sampleColorIndex(cellX, cellY, worldX, worldY, seedHash) {
  const latBand = positiveMod(Math.floor(worldY / BIOME_BAND_HEIGHT), COLOR_LUT.length);
  const gradient = Math.sin(worldX * 0.02) + Math.cos(worldY * 0.015);
  let gradientOffset = 0;
  if (gradient > 0.9) {
    gradientOffset = 2;
  } else if (gradient > 0.35) {
    gradientOffset = 1;
  } else if (gradient < -0.9) {
    gradientOffset = -2;
  } else if (gradient < -0.35) {
    gradientOffset = -1;
  }

  const jitter = (pseudoRandom(cellX, cellY, seedHash) % 3) - 1; // -1, 0, 1
  const index = positiveMod(latBand + gradientOffset + jitter, COLOR_LUT.length);
  return index;
}

function drawAxes(ctx, { viewportWidth, viewportHeight, panX, panY, zoom, pixelRatio }) {
  const zoomSafe = Math.max(zoom || 1, Number.EPSILON);
  const originX = snapToDevice(panX, pixelRatio);
  const originY = snapToDevice(panY, pixelRatio);

  ctx.save();
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = Math.max(1 / pixelRatio, 1 / (zoomSafe * pixelRatio));

  ctx.beginPath();
  ctx.moveTo(snapToDevice(0, pixelRatio), originY);
  ctx.lineTo(snapToDevice(viewportWidth, pixelRatio), originY);
  ctx.moveTo(originX, snapToDevice(0, pixelRatio));
  ctx.lineTo(originX, snapToDevice(viewportHeight, pixelRatio));
  ctx.stroke();
  ctx.restore();
}

function hashSeed(seed) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pseudoRandom(x, y, seedHash) {
  let h = seedHash ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function positiveMod(value, modulus) {
  const mod = modulus <= 0 ? 1 : modulus;
  return ((value % mod) + mod) % mod;
}

function snapToDevice(value, pixelRatio) {
  return Math.round(value * pixelRatio) / pixelRatio;
}
