/**
 * Parameters:
 * - marginPx: number — optional canvas padding around the render surface (default 0).
 * - FPS_SMOOTHING: number — exponential moving average factor for the FPS readout.
 * - FRAME_MAX_DT: number — clamp for delta time spikes in milliseconds.
 */
import { initUI } from './ui.js';
import { draw } from './render.js';

const marginPx = 0;
const FPS_SMOOTHING = 0.15;
const FRAME_MAX_DT = 1000;

const canvas = document.getElementById('map');
const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
if (!context) {
  throw new Error('Failed to acquire 2D rendering context for #map canvas.');
}
context.imageSmoothingEnabled = false;

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
  window.requestAnimationFrame(tick);
}

function bootstrap() {
  resizeCanvas();
  ui.updateState(state);
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.requestAnimationFrame(tick);
}

bootstrap();
