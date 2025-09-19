/**
 * Parameters:
 * - HEATMAP_RAMP: Array<[number, number[]]> — elevation color stops for biome-tinted mode.
 * - CONTOUR_STEP_CELLS: number — grid spacing in world cells for contour overlay.
 * - CONTOUR_COLOR: string — RGBA stroke color for contour grid lines.
 */
const HEATMAP_RAMP = [
  [0.0, [16, 36, 68, 255]],
  [0.25, [34, 82, 120, 255]],
  [0.5, [86, 142, 96, 255]],
  [0.75, [164, 146, 96, 255]],
  [0.9, [210, 196, 168, 255]],
  [1.0, [244, 244, 240, 255]],
];
const CONTOUR_STEP_CELLS = 16;
const CONTOUR_COLOR = 'rgba(255, 255, 255, 0.08)';

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
  const { context: ctx, pixelRatio = 1, width, height } = view;
  if (!ctx) return;

  const imageData = ensureImageData(ctx, width, height);
  if (state?.world?.elev instanceof Float32Array) {
    rasterizeElevation(imageData, state, pixelRatio);
  } else {
    rasterizePlaceholder(imageData);
  }

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.putImageData(imageData, 0, 0);
  ctx.restore();

  if (state?.layers?.contours && state?.world?.elev) {
    ctx.save();
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const cssWidth = width / pixelRatio;
    const cssHeight = height / pixelRatio;
    drawContourGrid(ctx, state, cssWidth, cssHeight);
    ctx.restore();
  }
}

function ensureImageData(ctx, width, height) {
  if (!cachedImageData || cachedWidth !== width || cachedHeight !== height) {
    cachedWidth = width;
    cachedHeight = height;
    cachedImageData = ctx.createImageData(width, height);
  }
  return cachedImageData;
}

function rasterizeElevation(imageData, state, pixelRatio) {
  const { data, width, height } = imageData;
  const world = state.world;
  const view = state.view || {};
  const layers = state.layers || {};
  const zoom = Math.max(view.zoom || 1, Number.EPSILON);
  const panX = view.panX || 0;
  const panY = view.panY || 0;
  const invPixelRatio = 1 / (pixelRatio || 1);
  const worldWidth = world.width || 1;
  const worldHeight = world.height || 1;
  const cellSize = computeCellSize(view, worldWidth, worldHeight);
  const halfWidth = (worldWidth * cellSize) / 2;
  const halfHeight = (worldHeight * cellSize) / 2;
  const grayscale = layers.biomes === false;

  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    const cssY = y * invPixelRatio;
    const worldY = (cssY - panY) / zoom;
    const sampleY = (worldY + halfHeight) / cellSize;
    const iy = clampIndex(sampleY, worldHeight);

    for (let x = 0; x < width; x += 1) {
      const cssX = x * invPixelRatio;
      const worldX = (cssX - panX) / zoom;
      const sampleX = (worldX + halfWidth) / cellSize;
      const ix = clampIndex(sampleX, worldWidth);
      const value = world.elev[iy * worldWidth + ix] ?? 0;
      const color = grayscale ? sampleGrayscale(value) : sampleRamp(value);
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = 255;
      offset += 4;
    }
  }
}

function rasterizePlaceholder(imageData) {
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 24;
    data[i + 1] = 28;
    data[i + 2] = 36;
    data[i + 3] = 255;
  }
}

function drawContourGrid(ctx, state, cssWidth, cssHeight) {
  const world = state.world;
  const view = state.view || {};
  const zoom = Math.max(view.zoom || 1, Number.EPSILON);
  const panX = view.panX || 0;
  const panY = view.panY || 0;
  const cellSize = computeCellSize(view, world.width || 1, world.height || 1);

  ctx.beginPath();
  ctx.strokeStyle = CONTOUR_COLOR;
  ctx.lineWidth = 1;

  for (let x = 0; x <= world.width; x += CONTOUR_STEP_CELLS) {
    const worldX = (x - world.width / 2) * cellSize;
    const cssX = worldX * zoom + panX;
    if (cssX + 1 < 0 || cssX - 1 > cssWidth) {
      continue;
    }
    const px = Math.round(cssX) + 0.5;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, cssHeight);
  }

  for (let y = 0; y <= world.height; y += CONTOUR_STEP_CELLS) {
    const worldY = (y - world.height / 2) * cellSize;
    const cssY = worldY * zoom + panY;
    if (cssY + 1 < 0 || cssY - 1 > cssHeight) {
      continue;
    }
    const py = Math.round(cssY) + 0.5;
    ctx.moveTo(0, py);
    ctx.lineTo(cssWidth, py);
  }

  ctx.stroke();
}

function computeCellSize(view, worldWidth, worldHeight) {
  if (!Number.isFinite(worldWidth) || !Number.isFinite(worldHeight) || worldWidth <= 0 || worldHeight <= 0) {
    return 1;
  }
  const width = Math.max(view.width || 0, 1);
  const height = Math.max(view.height || 0, 1);
  const scaleX = width / worldWidth;
  const scaleY = height / worldHeight;
  return Math.min(scaleX, scaleY);
}

function clampIndex(value, size) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const max = Math.max(0, size - 1);
  if (value <= 0) return 0;
  if (value >= max) return max;
  return Math.floor(value);
}

function sampleGrayscale(value) {
  const v = clamp01(value);
  const shade = Math.round(v * 255);
  return [shade, shade, shade, 255];
}

function sampleRamp(value) {
  const v = clamp01(value);
  for (let i = 0; i < HEATMAP_RAMP.length - 1; i += 1) {
    const [t0, c0] = HEATMAP_RAMP[i];
    const [t1, c1] = HEATMAP_RAMP[i + 1];
    if (v >= t0 && v <= t1) {
      const span = t1 - t0 || 1;
      const ratio = (v - t0) / span;
      return [
        Math.round(lerp(c0[0], c1[0], ratio)),
        Math.round(lerp(c0[1], c1[1], ratio)),
        Math.round(lerp(c0[2], c1[2], ratio)),
        Math.round(lerp(c0[3], c1[3], ratio)),
      ];
    }
  }
  const last = HEATMAP_RAMP[HEATMAP_RAMP.length - 1][1];
  return [last[0], last[1], last[2], last[3]];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
