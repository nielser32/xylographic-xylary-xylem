/**
 * Parameters:
 * - LAYER_LABELS: Record<string, string> — mapping of internal layer ids to UI labels.
 * - EVENT_NAMESPACE: string — prefix for dispatched CustomEvents.
 * - FPS_DECIMALS: number — decimal places shown in the FPS meter.
 */
const LAYER_LABELS = {
  rivers: 'Rivers',
  lakes: 'Lakes',
  contours: 'Contours',
  biomes: 'Biomes',
};
const EVENT_NAMESPACE = 'ui';
const FPS_DECIMALS = 1;

function createLabeledControl(tag, text) {
  const label = document.createElement('label');
  label.classList.add('stack');
  const textNode = document.createElement('span');
  textNode.textContent = text;
  const control = document.createElement(tag);
  label.append(textNode, control);
  return { label, control };
}

function dispatch(root, type, detail) {
  const event = new CustomEvent(`${EVENT_NAMESPACE}:${type}`, {
    detail,
    bubbles: false,
  });
  root.dispatchEvent(event);
}

/**
 * Initialize the overlay UI.
 * @param {HTMLElement} root
 * @param {{seed?: string, layers?: Record<string, boolean>}} initial
 */
export function initUI(root, initial = {}) {
  root.textContent = '';

  const form = document.createElement('form');
  form.classList.add('stack');
  form.setAttribute('autocomplete', 'off');

  const { label: seedLabel, control: seedInput } = createLabeledControl(
    'input',
    'Seed'
  );
  seedInput.type = 'text';
  seedInput.name = 'seed';
  seedInput.placeholder = 'Enter seed';
  seedInput.spellcheck = false;
  seedInput.autocomplete = 'off';
  seedInput.inputMode = 'text';

  const regenerateButton = document.createElement('button');
  regenerateButton.type = 'submit';
  regenerateButton.textContent = 'Regenerate';
  regenerateButton.title = 'Generate a new world using the current seed';

  const fpsMeter = document.createElement('span');
  fpsMeter.className = 'fps-meter';
  fpsMeter.textContent = '--.- FPS';

  const layersFieldset = document.createElement('fieldset');
  const legend = document.createElement('legend');
  legend.textContent = 'Layers';
  layersFieldset.append(legend);

  const toggleWrappers = {};
  for (const [layerId, labelText] of Object.entries(LAYER_LABELS)) {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '0.5rem';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = `layer-${layerId}`;
    checkbox.checked = initial.layers ? !!initial.layers[layerId] : true;
    checkbox.addEventListener('change', () => {
      dispatch(root, 'toggle-layer', { layer: layerId, enabled: checkbox.checked });
    });

    const span = document.createElement('span');
    span.textContent = labelText;

    wrapper.append(checkbox, span);
    layersFieldset.append(wrapper);
    toggleWrappers[layerId] = checkbox;
  }

  form.append(seedLabel, regenerateButton);
  root.append(form, layersFieldset, fpsMeter);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const seed = seedInput.value.trim();
    dispatch(root, 'regenerate', { seed });
  });

  seedInput.addEventListener('change', () => {
    const seed = seedInput.value.trim();
    dispatch(root, 'seed-change', { seed });
  });

  const api = {
    root,
    updateState(nextState) {
      if (typeof nextState.seedText === 'string' && nextState.seedText !== seedInput.value) {
        seedInput.value = nextState.seedText;
      } else if (typeof nextState.seed === 'string' && nextState.seed !== seedInput.value) {
        seedInput.value = nextState.seed;
      }
      if (nextState.layers) {
        for (const layerId of Object.keys(LAYER_LABELS)) {
          if (layerId in nextState.layers) {
            toggleWrappers[layerId].checked = !!nextState.layers[layerId];
          }
        }
      }
    },
    updateFPS(fpsValue) {
      if (!Number.isFinite(fpsValue) || fpsValue <= 0) {
        fpsMeter.textContent = '--.- FPS';
        return;
      }
      fpsMeter.textContent = `${fpsValue.toFixed(FPS_DECIMALS)} FPS`;
    },
  };

  api.updateState(initial);
  return api;
}
