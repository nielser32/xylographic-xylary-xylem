const canvas = document.getElementById('graph-canvas');
const statusEl = document.getElementById('graph-status');
const detailPanel = document.getElementById('detail-panel');
const detailTitle = document.getElementById('detail-title');
const detailDescription = document.getElementById('detail-description');
const detailFiles = document.getElementById('detail-files');
const detailFilesList = detailFiles.querySelector('ul');
const detailClose = document.getElementById('detail-close');

const ctx = canvas.getContext('2d');
const state = {
  nodes: [],
  links: [],
  hovered: null,
  selected: null,
  dragging: null,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

function resizeCanvas() {
  const shell = document.getElementById('graph-shell');
  const { clientWidth, clientHeight } = shell;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = clientWidth * dpr;
  canvas.height = clientHeight * dpr;
  canvas.style.width = `${clientWidth}px`;
  canvas.style.height = `${clientHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  centerAnchor();
}

function centerAnchor() {
  const shell = document.getElementById('graph-shell');
  const { clientWidth, clientHeight } = shell;
  const anchor = state.nodes.find((node) => node.anchor);
  if (anchor) {
    anchor.x = clientWidth / 2;
    anchor.y = clientHeight / 2;
    anchor.vx = 0;
    anchor.vy = 0;
  }
}

function createNodes(items) {
  const shell = document.getElementById('graph-shell');
  const { clientWidth, clientHeight } = shell;
  const center = {
    id: 'atlas-core',
    title: 'Atlas Core',
    anchor: true,
    x: clientWidth / 2,
    y: clientHeight / 2,
    vx: 0,
    vy: 0,
    radius: 28,
  };

  const nodes = items.map((item, index) => {
    const angle = (index / Math.max(1, items.length)) * Math.PI * 2;
    const radius = Math.min(clientWidth, clientHeight) * 0.35;
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      files: item.files ?? [],
      x: center.x + Math.cos(angle) * radius * (0.7 + Math.random() * 0.3),
      y: center.y + Math.sin(angle) * radius * (0.7 + Math.random() * 0.3),
      vx: 0,
      vy: 0,
      radius: 18 + Math.min(12, (item.files?.length ?? 0) * 3),
    };
  });

  const links = nodes.map((node) => ({ source: center, target: node, length: 140 }));

  state.nodes = [center, ...nodes];
  state.links = links;
}

function draw() {
  const shell = document.getElementById('graph-shell');
  const width = shell.clientWidth;
  const height = shell.clientHeight;

  ctx.save();
  ctx.setTransform((window.devicePixelRatio || 1), 0, 0, (window.devicePixelRatio || 1), 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(12, 12, 15, 0.92)';
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1.2;
  for (const link of state.links) {
    const { source, target } = link;
    ctx.strokeStyle = target === state.selected ? 'rgba(255, 51, 158, 0.55)' : 'rgba(236, 153, 255, 0.22)';
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  }

  for (const node of state.nodes) {
    const gradient = ctx.createRadialGradient(node.x, node.y, node.radius * 0.1, node.x, node.y, node.radius);
    if (node.anchor) {
      gradient.addColorStop(0, 'rgba(255, 51, 158, 0.85)');
      gradient.addColorStop(1, 'rgba(255, 51, 158, 0.1)');
    } else if (node === state.selected) {
      gradient.addColorStop(0, 'rgba(36, 217, 244, 0.9)');
      gradient.addColorStop(1, 'rgba(36, 217, 244, 0.2)');
    } else if (node === state.hovered) {
      gradient.addColorStop(0, 'rgba(236, 153, 255, 0.85)');
      gradient.addColorStop(1, 'rgba(236, 153, 255, 0.2)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 51, 158, 0.65)');
      gradient.addColorStop(1, 'rgba(255, 51, 158, 0.12)');
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fill();

    if (!node.anchor) {
      ctx.fillStyle = 'rgba(248, 247, 247, 0.92)';
      ctx.font = '500 12px "Space Grotesk", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = node.title.length > 24 ? `${node.title.slice(0, 22)}…` : node.title;
      ctx.fillText(label, node.x, node.y);
    }

    if (node === state.selected) {
      ctx.strokeStyle = 'rgba(36, 217, 244, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function simulate() {
  if (state.reducedMotion) {
    draw();
    return;
  }

  const shell = document.getElementById('graph-shell');
  const width = shell.clientWidth;
  const height = shell.clientHeight;
  const nodes = state.nodes;

  for (let i = 0; i < nodes.length; i += 1) {
    const nodeA = nodes[i];
    for (let j = i + 1; j < nodes.length; j += 1) {
      const nodeB = nodes[j];
      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const distanceSq = Math.max(dx * dx + dy * dy, 25);
      const force = 1500 / distanceSq;
      const dist = Math.sqrt(distanceSq);
      const fx = (force * dx) / dist;
      const fy = (force * dy) / dist;
      if (!nodeA.anchor && state.dragging !== nodeA) {
        nodeA.vx -= fx;
        nodeA.vy -= fy;
      }
      if (!nodeB.anchor && state.dragging !== nodeB) {
        nodeB.vx += fx;
        nodeB.vy += fy;
      }
    }
  }

  for (const link of state.links) {
    const { source, target, length } = link;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
    const displacement = distance - length;
    const spring = 0.01 * displacement;
    const fx = (spring * dx) / distance;
    const fy = (spring * dy) / distance;
    if (!source.anchor && state.dragging !== source) {
      source.vx += fx;
      source.vy += fy;
    }
    if (!target.anchor && state.dragging !== target) {
      target.vx -= fx;
      target.vy -= fy;
    }
  }

  for (const node of nodes) {
    if (node.anchor) continue;
    const centeringStrength = 0.003;
    node.vx += (width / 2 - node.x) * centeringStrength;
    node.vy += (height / 2 - node.y) * centeringStrength;

    node.vx *= 0.88;
    node.vy *= 0.88;

    if (state.dragging === node) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }

    node.x += node.vx;
    node.y += node.vy;

    node.x = Math.max(node.radius, Math.min(width - node.radius, node.x));
    node.y = Math.max(node.radius, Math.min(height - node.radius, node.y));
  }

  draw();
  requestAnimationFrame(simulate);
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function findNodeAtPosition(position) {
  for (let i = state.nodes.length - 1; i >= 0; i -= 1) {
    const node = state.nodes[i];
    const dx = position.x - node.x;
    const dy = position.y - node.y;
    if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 4) {
      return node;
    }
  }
  return null;
}

function updateDetailPanel(node) {
  if (!node || node.anchor) {
    detailTitle.textContent = 'Choose a node';
    detailDescription.textContent =
      'The knowledge atlas is waiting. Select an item from the graph to surface its description and related files right here.';
    detailFiles.classList.add('hidden');
    detailFilesList.innerHTML = '';
    detailPanel.classList.remove('border-primary/40');
    return;
  }

  detailTitle.textContent = node.title;
  detailDescription.textContent = node.description?.trim()
    ? node.description
    : 'No description available yet. Add one to give this node more context.';

  detailFilesList.innerHTML = '';
  if (node.files && node.files.length > 0) {
    for (const file of node.files) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `/api/files/${file.id}`;
      link.textContent = file.originalName;
      link.className =
        'focus-ring inline-flex w-full items-center justify-between gap-2 rounded-lg border border-primary/30 bg-charcoal-700/70 px-3 py-2 text-sm text-secondary transition hover:text-secondary';
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer noopener');
      item.appendChild(link);
      detailFilesList.appendChild(item);
    }
    detailFiles.classList.remove('hidden');
  } else {
    detailFiles.classList.add('hidden');
  }
  detailPanel.classList.add('border-primary/40');
}

function handleSelection(node) {
  if (!node || node.anchor) return;
  state.selected = node;
  updateDetailPanel(node);
  draw();
}

function clearSelection() {
  state.selected = null;
  updateDetailPanel(null);
  draw();
}

canvas.addEventListener('pointermove', (event) => {
  const position = getPointerPosition(event);
  const node = findNodeAtPosition(position);
  if (node && !node.anchor) {
    canvas.style.cursor = 'pointer';
  } else {
    canvas.style.cursor = state.dragging ? 'grabbing' : 'grab';
  }
  state.hovered = node && !node.anchor ? node : null;
  if (!state.reducedMotion) {
    draw();
  }
  if (state.dragging) {
    state.dragging.x = position.x;
    state.dragging.y = position.y;
  }
});

canvas.addEventListener('pointerdown', (event) => {
  const position = getPointerPosition(event);
  const node = findNodeAtPosition(position);
  if (node && !node.anchor) {
    state.dragging = node;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
    node.x = position.x;
    node.y = position.y;
  }
});

canvas.addEventListener('pointerup', (event) => {
  if (state.dragging) {
    canvas.releasePointerCapture(event.pointerId);
    state.dragging = null;
    canvas.style.cursor = 'grab';
  }
});

canvas.addEventListener('pointerleave', () => {
  state.hovered = null;
  if (!state.dragging) {
    canvas.style.cursor = 'grab';
  }
});

canvas.addEventListener('click', (event) => {
  const position = getPointerPosition(event);
  const node = findNodeAtPosition(position);
  if (node && !node.anchor) {
    handleSelection(node);
  }
});

detailClose.addEventListener('click', () => {
  clearSelection();
  detailClose.blur();
});

async function loadItems() {
  try {
    statusEl.textContent = 'Loading nodes…';
    const response = await fetch('/api/items');
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      statusEl.textContent = 'No items yet — add one via the API to watch the graph grow.';
      createNodes([]);
      draw();
      return;
    }
    statusEl.textContent = '';
    createNodes(data);
    draw();
    simulate();
  } catch (error) {
    console.error(error);
    statusEl.textContent = 'We were unable to load the graph. Please try again later.';
    createNodes([]);
    draw();
  }
}

function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  canvas.style.cursor = 'grab';
  loadItems();
}

init();
