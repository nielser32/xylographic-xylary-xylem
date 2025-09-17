/**
 * Parameters:
 * - COLOR_LUT: Uint8 RGBA tuples — placeholder biome colors chosen for color-blind safety.
 * - TILE_WORLD_SIZE: number — world-space size of the synthetic tile cells in CSS pixels.
 * - NEUTRAL_CHECKER_COLORS: RGBA tuples used when biome layers are disabled.
 * - NEUTRAL_CHECKER_SIZE: number — checkerboard cell size in CSS pixels.
 * - CONTOUR_TILE_INTERVAL: number — how many tiles between contour placeholder grid lines.
 * - CONTOUR_COLOR: string — stroke color for contour placeholder grid lines.
 * - CROSSHAIR_COLOR: string — color of the viewport-centered crosshair overlay.
 */
import { noise2D } from './noise.js';

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
const NEUTRAL_CHECKER_COLORS = [
  [60, 60, 68, 255],
  [44, 44, 50, 255],
];
const NEUTRAL_CHECKER_SIZE = TILE_WORLD_SIZE;
const CONTOUR_TILE_INTERVAL = 8;
const CONTOUR_COLOR = 'rgba(255, 255, 255, 0.08)';
const CROSSHAIR_COLOR = 'rgba(255, 255, 255, 0.24)';

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
  const dpr = pixelRatio || 1;
  const viewState = state?.view || {};
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (state?.layers?.contours) {
    drawContourGrid(ctx, {
      viewportWidth: cssWidth,
      viewportHeight: cssHeight,
      panX: viewState.panX || 0,
      panY: viewState.panY || 0,
      zoom: viewState.zoom || 1,
      pixelRatio: dpr,
    });
  }
  drawCrosshair(ctx, {
    viewportWidth: cssWidth,
    viewportHeight: cssHeight,
    pixelRatio: dpr,
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
  const showBiomes = state?.layers?.biomes !== false;
  const seedValue = state?.seed ?? 0;
  const seedHash = hashSeed(String(seedValue));

  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    const cssY = y * invPixelRatio;
    const worldY = (cssY - panY) / zoom;
    const cellY = Math.floor(worldY / TILE_WORLD_SIZE);

    let cssX = 0;
    for (let x = 0; x < width; x += 1) {
      const worldX = (cssX - panX) / zoom;
      const cellX = Math.floor(worldX / TILE_WORLD_SIZE);

      const color = showBiomes
        ? sampleBiomeColor(worldX, worldY, cellX, cellY, seedValue, seedHash)
        : sampleNeutralColor(worldX, worldY);

      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = color[3];
      offset += 4;

      cssX += invPixelRatio;
    }
  }
}

function sampleBiomeColor(worldX, worldY, cellX, cellY, seedValue, seedHash) {
  const fbm = noise2D(worldX, worldY, {
    seed: seedValue,
    frequency: 0.002,
    octaves: 5,
    lacunarity: 2,
    gain: 0.5,
  });
  const latPhase = (seedHash & 0xffff) * 0.00001;
  const latitudeGradient = Math.sin(worldY * 0.0008 + latPhase);
  const jitter = ((pseudoRandom(cellX, cellY, seedHash) / 0xffffffff) - 0.5) * 0.18;
  const combined = fbm * 0.7 + latitudeGradient * 0.3 + jitter;
  const normalized = clamp01(0.5 + 0.5 * combined);
  const index = Math.min(
    COLOR_LUT.length - 1,
    Math.round(normalized * (COLOR_LUT.length - 1)),
  );
  return COLOR_LUT[index];
}

function sampleNeutralColor(worldX, worldY) {
  const checkerX = Math.floor(worldX / NEUTRAL_CHECKER_SIZE);
  const checkerY = Math.floor(worldY / NEUTRAL_CHECKER_SIZE);
  const parity = (Math.abs(checkerX) + Math.abs(checkerY)) % 2;
  return NEUTRAL_CHECKER_COLORS[parity];
}

function drawContourGrid(ctx, { viewportWidth, viewportHeight, panX, panY, zoom, pixelRatio }) {
  const zoomSafe = Math.max(zoom || 1, Number.EPSILON);
  const worldSpacing = TILE_WORLD_SIZE * CONTOUR_TILE_INTERVAL;
  if (!Number.isFinite(worldSpacing) || worldSpacing <= 0) {
    return;
  }

  const leftWorld = (-panX) / zoomSafe;
  const rightWorld = (viewportWidth - panX) / zoomSafe;
  const topWorld = (-panY) / zoomSafe;
  const bottomWorld = (viewportHeight - panY) / zoomSafe;

  const verticalStart = Math.floor(leftWorld / worldSpacing);
  const verticalEnd = Math.ceil(rightWorld / worldSpacing);
  const horizontalStart = Math.floor(topWorld / worldSpacing);
  const horizontalEnd = Math.ceil(bottomWorld / worldSpacing);

  ctx.save();
  ctx.strokeStyle = CONTOUR_COLOR;
  ctx.lineWidth = Math.max(1 / pixelRatio, 0.75 / (zoomSafe * pixelRatio));
  ctx.beginPath();

  const snappedTop = snapToDevice(0, pixelRatio);
  const snappedBottom = snapToDevice(viewportHeight, pixelRatio);
  for (let ix = verticalStart; ix <= verticalEnd; ix += 1) {
    const worldX = ix * worldSpacing;
    const cssX = snapToDevice(worldX * zoomSafe + panX, pixelRatio);
    ctx.moveTo(cssX, snappedTop);
    ctx.lineTo(cssX, snappedBottom);
  }

  const snappedLeft = snapToDevice(0, pixelRatio);
  const snappedRight = snapToDevice(viewportWidth, pixelRatio);
  for (let iy = horizontalStart; iy <= horizontalEnd; iy += 1) {
    const worldY = iy * worldSpacing;
    const cssY = snapToDevice(worldY * zoomSafe + panY, pixelRatio);
    ctx.moveTo(snappedLeft, cssY);
    ctx.lineTo(snappedRight, cssY);
  }

  ctx.stroke();
  ctx.restore();
}

function drawCrosshair(ctx, { viewportWidth, viewportHeight, pixelRatio }) {
  const centerX = snapToDevice(viewportWidth / 2, pixelRatio);
  const centerY = snapToDevice(viewportHeight / 2, pixelRatio);

  ctx.save();
  ctx.strokeStyle = CROSSHAIR_COLOR;
  ctx.lineWidth = 1 / pixelRatio;
  ctx.beginPath();
  ctx.moveTo(centerX, snapToDevice(0, pixelRatio));
  ctx.lineTo(centerX, snapToDevice(viewportHeight, pixelRatio));
  ctx.moveTo(snapToDevice(0, pixelRatio), centerY);
  ctx.lineTo(snapToDevice(viewportWidth, pixelRatio), centerY);
  ctx.stroke();
  ctx.restore();
}

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
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

function snapToDevice(value, pixelRatio) {
  return Math.round(value * pixelRatio) / pixelRatio;
}
