/**
 * Parameters:
 * - COLOR_LUT: Uint8 RGBA tuples — placeholder biome colors chosen for color-blind safety.
 * - TILE_WORLD_SIZE: number — world-space size of the synthetic tile cells in CSS pixels.
 * - BASE_NOISE_FREQUENCY: number — base frequency for elevation noise in world units.
 * - MOISTURE_NOISE_SCALE: number — multiplier for secondary moisture noise frequency.
 * - FLOW_NOISE_SCALE: number — multiplier for placeholder flow noise frequency.
 * - LAKE_THRESHOLD: number — normalized elevation threshold for painting lakes.
 * - RIVER_THRESHOLD: number — threshold on the placeholder flow mask for rivers.
 * - CONTOUR_INTERVAL: number — normalized elevation step between contour bands.
 * - CONTOUR_HALF_WIDTH: number — band half-width controlling contour line thickness.
 * - AXIS_COLOR: string — color of the origin crosshair overlay.
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
const BASE_NOISE_FREQUENCY = 0.0015;
const MOISTURE_NOISE_SCALE = 1.75;
const FLOW_NOISE_SCALE = 2.35;
const LAKE_THRESHOLD = 0.34;
const RIVER_THRESHOLD = 0.78;
const CONTOUR_INTERVAL = 0.05;
const CONTOUR_HALF_WIDTH = 0.014;
const AXIS_COLOR = 'rgba(255, 255, 255, 0.18)';
const LAKE_COLOR = [44, 96, 160];
const RIVER_COLOR = [52, 136, 204];
const LATITUDE_VARIATION = 1 / (TILE_WORLD_SIZE * 18);
const MOISTURE_OFFSET_X = 4096.5;
const MOISTURE_OFFSET_Y = -2048.25;
const FLOW_OFFSET_X = -1638.4;
const FLOW_OFFSET_Y = 987.2;

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
  const invPixelRatio = 1 / (pixelRatio || 1);

  const seed = state?.seed ?? 'default';
  const baseOptions = {
    frequency: BASE_NOISE_FREQUENCY,
    octaves: 5,
    gain: 0.5,
    lacunarity: 2.0,
    seed,
  };
  const moistureOptions = {
    frequency: BASE_NOISE_FREQUENCY * MOISTURE_NOISE_SCALE,
    octaves: 4,
    gain: 0.55,
    lacunarity: 2.15,
    seed: `${seed}-moisture`,
  };
  const flowOptions = {
    frequency: BASE_NOISE_FREQUENCY * FLOW_NOISE_SCALE,
    octaves: 3,
    gain: 0.6,
    lacunarity: 2.05,
    seed: `${seed}-flow`,
  };

  const layers = state?.layers || {};
  const showBiomes = layers.biomes !== false;
  const showRivers = layers.rivers !== false;
  const showLakes = layers.lakes !== false;
  const showContours = layers.contours === true;

  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    const cssY = y * invPixelRatio;
    const worldY = (cssY - panY) / zoom;

    let cssX = 0;
    for (let x = 0; x < width; x += 1) {
      const worldX = (cssX - panX) / zoom;

      const elevation = noise2D(worldX, worldY, baseOptions);
      const height01 = clamp01(0.5 * (elevation + 1));

      let r;
      let g;
      let b;

      if (showBiomes) {
        const moistureValue = noise2D(
          worldX + MOISTURE_OFFSET_X,
          worldY + MOISTURE_OFFSET_Y,
          moistureOptions,
        );
        const humidity = clamp01(0.5 * (moistureValue + 1));
        const colorIndex = pickBiomeIndex(height01, humidity, worldY);
        const color = COLOR_LUT[colorIndex];
        r = color[0];
        g = color[1];
        b = color[2];
      } else {
        const grey = Math.round(lerp(36, 220, height01));
        r = grey;
        g = grey;
        b = grey;
      }

      if (showLakes && height01 < LAKE_THRESHOLD) {
        const lakeStrength = clamp01((LAKE_THRESHOLD - height01) / LAKE_THRESHOLD);
        const blend = lakeStrength * 0.75;
        r = blendChannel(r, LAKE_COLOR[0], blend);
        g = blendChannel(g, LAKE_COLOR[1], blend);
        b = blendChannel(b, LAKE_COLOR[2], blend);
      }

      if (showRivers) {
        const flowNoise = noise2D(
          worldX + FLOW_OFFSET_X,
          worldY + FLOW_OFFSET_Y,
          flowOptions,
        );
        const riverMask = clamp01(1 - Math.abs(flowNoise));
        if (riverMask > RIVER_THRESHOLD && height01 >= LAKE_THRESHOLD) {
          const strength = clamp01((riverMask - RIVER_THRESHOLD) / (1 - RIVER_THRESHOLD));
          const mix = 0.4 + strength * 0.5;
          r = blendChannel(r, RIVER_COLOR[0], mix);
          g = blendChannel(g, RIVER_COLOR[1], mix);
          b = blendChannel(b, RIVER_COLOR[2], mix);
        }
      }

      if (showContours) {
        const contour = height01 / CONTOUR_INTERVAL;
        const distance = Math.abs(contour - Math.round(contour));
        const halfWidth = CONTOUR_HALF_WIDTH / Math.max(zoom, 1);
        if (distance < halfWidth) {
          const darkness = 0.55;
          r = Math.max(0, Math.round(r * darkness));
          g = Math.max(0, Math.round(g * darkness));
          b = Math.max(0, Math.round(b * darkness));
        }
      }

      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = 255;
      offset += 4;

      cssX += invPixelRatio;
    }
  }
}

function pickBiomeIndex(height01, humidity, worldY) {
  if (height01 < 0.24) {
    if (height01 < 0.15) return 0;
    if (height01 < 0.2) return 1;
    return 2;
  }
  if (height01 < 0.32) {
    return 3;
  }
  if (height01 > 0.82) {
    return 7;
  }

  const latitude = clamp01(0.5 + 0.5 * Math.sin(worldY * LATITUDE_VARIATION));
  const humidityBias = clamp01(humidity + (0.5 - latitude) * 0.25);
  const dryness = clamp01(1 - humidityBias + height01 * 0.15);

  if (dryness < 0.33) {
    return 4;
  }
  if (dryness < 0.66) {
    return 5;
  }
  return 6;
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

function blendChannel(base, overlay, alpha) {
  return Math.round(base * (1 - alpha) + overlay * alpha);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function snapToDevice(value, pixelRatio) {
  return Math.round(value * pixelRatio) / pixelRatio;
}
