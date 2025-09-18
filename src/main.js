/**
 * Parameters:
 * - marginPx: number — optional canvas padding around the render surface (default 0).
 * - FPS_SMOOTHING: number — exponential moving average factor for the FPS readout.
 * - FRAME_MAX_DT: number — clamp for delta time spikes in milliseconds.
 * - MIN_ZOOM: number — lower bound for zoom level.
 * - MAX_ZOOM: number — upper bound for zoom level.
 * - ZOOM_SENSITIVITY: number — wheel delta multiplier controlling zoom speed.
 */
import { initUI } from './ui.js';
import { draw } from './render.js';

const marginPx = 0;
const FPS_SMOOTHING = 0.15;
const FRAME_MAX_DT = 1000;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 16;
const ZOOM_SENSITIVITY = 0.0015;

const canvas = document.getElementById('map');
const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
if (!context) {
  throw new Error('Failed to acquire 2D rendering context for #map canvas.');
}
context.imageSmoothingEnabled = false;
canvas.style.touchAction = 'none';

const uiRoot = document.getElementById('ui-root');
if (!uiRoot) {
  throw new Error('UI root element is missing.');
}

const initialSeed = `${Date.now()}`;

const state = {
  seed: initialSeed,
  layers: {
    rivers: true,
    lakes: true,
    contours: false,
    biomes: true,
  },
  view: {
    panX: 0,
    panY: 0,
    zoom: 1,
    pixelRatio: window.devicePixelRatio || 1,
    width: window.innerWidth,
    height: window.innerHeight,
    margin: marginPx,
    initialized: false,
  },
  frame: {
    fps: 0,
    lastTimestamp: performance.now(),
  },
  dirty: true,
};

const ui = initUI(uiRoot, {
  seed: state.seed,
  layers: state.layers,
});

uiRoot.addEventListener('ui:seed-change', (event) => {
  const { seed } = event.detail;
  state.seed = seed;
  state.dirty = true;
  ui.updateState(state);
});

uiRoot.addEventListener('ui:regenerate', (event) => {
  const { seed } = event.detail;
  state.seed = seed;
  resetView();
  ui.updateState(state);
});

uiRoot.addEventListener('ui:toggle-layer', (event) => {
  const { layer, enabled } = event.detail;
  if (layer in state.layers) {
    state.layers[layer] = enabled;
    state.dirty = true;
    ui.updateState(state);
  }
});

const activePointer = {
  id: null,
  lastX: 0,
  lastY: 0,
};

canvas.addEventListener(
  'pointerdown',
  (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    activePointer.id = event.pointerId;
    activePointer.lastX = event.clientX;
    activePointer.lastY = event.clientY;
  },
  { passive: false },
);

canvas.addEventListener(
  'pointermove',
  (event) => {
    if (activePointer.id !== event.pointerId) {
      return;
    }
    const deltaX = event.clientX - activePointer.lastX;
    const deltaY = event.clientY - activePointer.lastY;
    if (deltaX === 0 && deltaY === 0) {
      return;
    }
    activePointer.lastX = event.clientX;
    activePointer.lastY = event.clientY;
    state.view.panX += deltaX;
    state.view.panY += deltaY;
    state.dirty = true;
  },
  { passive: true },
);

function clearPointer(event) {
  if (activePointer.id !== event.pointerId) {
    return;
  }
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
  activePointer.id = null;
}

canvas.addEventListener('pointerup', clearPointer);
canvas.addEventListener('pointercancel', clearPointer);
canvas.addEventListener('pointerleave', clearPointer);

canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    const delta = event.deltaY;
    if (delta === 0) {
      return;
    }

    const zoomFactor = Math.exp(-delta * ZOOM_SENSITIVITY);
    const targetZoom = clamp(state.view.zoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
    if (targetZoom === state.view.zoom) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const focusX = event.clientX - rect.left;
    const focusY = event.clientY - rect.top;
    applyZoom(focusX, focusY, targetZoom);
  },
  { passive: false },
);

function applyZoom(focusX, focusY, zoom) {
  const previousZoom = clamp(state.view.zoom || 1, MIN_ZOOM, MAX_ZOOM);
  const newZoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const ratio = newZoom / previousZoom;

  state.view.panX = focusX - ratio * (focusX - state.view.panX);
  state.view.panY = focusY - ratio * (focusY - state.view.panY);
  state.view.zoom = newZoom;
  state.dirty = true;
}

function resetView() {
  state.view.zoom = 1;
  state.view.panX = state.view.width / 2;
  state.view.panY = state.view.height / 2;
  state.dirty = true;
}

function resizeCanvas() {
  const { innerWidth, innerHeight } = window;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(innerWidth - marginPx * 2, 0);
  const cssHeight = Math.max(innerHeight - marginPx * 2, 0);
  const deviceWidth = Math.max(1, Math.floor(cssWidth * dpr));
  const deviceHeight = Math.max(1, Math.floor(cssHeight * dpr));

  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth;
    canvas.height = deviceHeight;
  }

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.style.margin = `${marginPx}px`;

  const previousWidth = state.view.width;
  const previousHeight = state.view.height;

  state.view.pixelRatio = dpr;
  state.view.width = cssWidth;
  state.view.height = cssHeight;

  if (!state.view.initialized) {
    state.view.panX = cssWidth / 2;
    state.view.panY = cssHeight / 2;
    state.view.initialized = true;
  } else {
    if (Number.isFinite(previousWidth)) {
      state.view.panX += (cssWidth - previousWidth) / 2;
    }
    if (Number.isFinite(previousHeight)) {
      state.view.panY += (cssHeight - previousHeight) / 2;
    }
  }

  state.dirty = true;
}

function updateFrameMetrics(now) {
  const delta = Math.min(now - state.frame.lastTimestamp, FRAME_MAX_DT);
  state.frame.lastTimestamp = now;
  if (delta > 0) {
    const instantaneous = 1000 / delta;
    if (state.frame.fps === 0) {
      state.frame.fps = instantaneous;
    } else {
      state.frame.fps = state.frame.fps + FPS_SMOOTHING * (instantaneous - state.frame.fps);
    }
  }
  ui.updateFPS(state.frame.fps);
}

function renderFrame() {
  const { pixelRatio } = state.view;
  draw(state, {
    context,
    pixelRatio,
    width: context.canvas.width,
    height: context.canvas.height,
  });
  state.dirty = false;
}

function tick(now) {
  updateFrameMetrics(now);
  if (state.dirty) {
    renderFrame();
  }
  window.requestAnimationFrame(tick);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function bootstrap() {
  resizeCanvas();
  resetView();
  ui.updateState(state);
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.requestAnimationFrame(tick);
}

bootstrap();
