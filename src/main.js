/**
 * Parameters:
 * - marginPx: number — optional canvas padding around the render surface (default 0).
 * - FPS_SMOOTHING: number — exponential moving average factor for the FPS readout.
 * - FRAME_MAX_DT: number — clamp for delta time spikes in milliseconds.
 * - MIN_ZOOM: number — minimum allowed zoom factor.
 * - MAX_ZOOM: number — maximum allowed zoom factor.
 * - WHEEL_ZOOM_SENSITIVITY: number — exponential zoom rate per wheel delta unit.
 */
import { initUI } from './ui.js';
import { draw } from './render.js';

const marginPx = 0;
const FPS_SMOOTHING = 0.15;
const FRAME_MAX_DT = 1000;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;

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
  // World generation will be triggered here once implemented.
  state.dirty = true;
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

function resizeCanvas() {
  const { innerWidth, innerHeight } = window;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = Math.max(innerWidth - marginPx * 2, 0);
  const cssHeight = Math.max(innerHeight - marginPx * 2, 0);
  const deviceWidth = Math.floor(cssWidth * dpr);
  const deviceHeight = Math.floor(cssHeight * dpr);

  if (canvas.width !== deviceWidth || canvas.height !== deviceHeight) {
    canvas.width = deviceWidth;
    canvas.height = deviceHeight;
  }

  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.style.margin = `${marginPx}px`;

  state.view.pixelRatio = dpr;
  state.view.width = cssWidth;
  state.view.height = cssHeight;
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
      state.frame.fps =
        state.frame.fps + FPS_SMOOTHING * (instantaneous - state.frame.fps);
    }
  }
  ui.updateFPS(state.frame.fps);
}

function renderFrame() {
  const { pixelRatio, width, height } = state.view;
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
  logFrameState();
  window.requestAnimationFrame(tick);
}

const pointerState = {
  active: false,
  id: null,
  lastX: 0,
  lastY: 0,
};

function handlePointerDown(event) {
  pointerState.active = true;
  pointerState.id = event.pointerId;
  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!pointerState.active || pointerState.id !== event.pointerId) {
    return;
  }

  const dx = event.clientX - pointerState.lastX;
  const dy = event.clientY - pointerState.lastY;
  if (dx === 0 && dy === 0) {
    return;
  }

  pointerState.lastX = event.clientX;
  pointerState.lastY = event.clientY;

  state.view.panX += dx;
  state.view.panY += dy;
  state.dirty = true;
}

function handlePointerUp(event) {
  if (pointerState.id === event.pointerId) {
    canvas.releasePointerCapture(event.pointerId);
    pointerState.active = false;
    pointerState.id = null;
  }
}

function handleWheel(event) {
  event.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const cursorX = event.clientX - rect.left;
  const cursorY = event.clientY - rect.top;

  const currentZoom = state.view.zoom;
  const zoomFactor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
  const nextZoom = clamp(currentZoom * zoomFactor, MIN_ZOOM, MAX_ZOOM);
  if (nextZoom === currentZoom) {
    return;
  }

  const worldX = (cursorX - state.view.panX) / currentZoom;
  const worldY = (cursorY - state.view.panY) / currentZoom;

  state.view.zoom = nextZoom;
  state.view.panX = cursorX - worldX * nextZoom;
  state.view.panY = cursorY - worldY * nextZoom;
  state.dirty = true;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function logFrameState() {
  const { seed } = state;
  const { zoom = 1, panX = 0, panY = 0 } = state.view;
  console.debug('frame', {
    seed,
    zoom: Number(zoom.toFixed(4)),
    panX: Number(panX.toFixed(2)),
    panY: Number(panY.toFixed(2)),
  });
}

function bootstrap() {
  resizeCanvas();
  ui.updateState(state);
  window.addEventListener('resize', resizeCanvas, { passive: true });
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  canvas.addEventListener('wheel', handleWheel, { passive: false });
  window.requestAnimationFrame(tick);
}

bootstrap();
