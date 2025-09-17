# Architecture Overview

This scaffold establishes the wiring for a browser-based procedural world generator written in vanilla JavaScript. The initial focus is on organizing modules, defining responsibilities, and ensuring the rendering surface is ready for future simulation stages.

## Module Responsibilities

- **`index.html`** — Declares the full-screen canvas (`#map`) and an overlay container for controls. Provides baseline styling to ensure an edge-to-edge viewport without scrollbars.
- **`src/main.js`** — Boots the application, owns the top-level `state` object, wires UI events to state mutations, maintains the animation loop with an FPS meter, and forwards render calls to `render.js`. Also handles device-pixel-aware resizing so the canvas always matches the viewport.
- **`src/ui.js`** — Builds the control bar (seed entry, regenerate button, layer toggles, FPS readout). Emits `CustomEvent`s (`ui:*`) that `main.js` consumes. Future UI agents will extend this module with import/export controls and debug overlays.
- **`src/render.js`** — Receives state and view metadata to draw the current frame. The placeholder implementation rasterizes a deterministic color-LUT tile map into ImageData with device-pixel snapping so pan/zoom logic stays verifiable without binary assets. Later revisions will swap in biome-aware rendering pipelines.
- **`src/worldgen.js`** — Placeholder factory for elevation fields. This module will orchestrate procedural world generation, eventually delegating to noise, hydrology, climate, and biome classification helpers.
- **`src/noise.js`** — Houses the deterministic random number generator and fractal noise sampling utilities, implemented with Mulberry32-seeded Simplex FBM to guarantee reproducible worlds.
- **`src/biomes.js`** — Placeholder biome classifier. Future agents will convert environmental fields (elevation, temperature, precipitation, moisture, hydrology flags) into biome identifiers via threshold tables and smoothing.
- **`presets/temperate_hemisphere.json`** — Seed configuration slot for reusable parameter packs.
- **`assets/.gitkeep`** — Keeps the assets directory tracked until art placeholders land.
- **`docs/ARCHITECTURE.md`** — Living design doc describing data flow and module contracts.

## Assets

No binary assets in PRs. Use inline SVG or data URIs when needed. Sprite atlas can be added in a post-merge commit.

## Planned Data Flow

1. **Elevation synthesis** (`worldgen.makeElevation`) uses deterministic noise and continental masks to produce a Float32Array of terrain heights.
2. **Hydrology modelling** consumes elevation to build flow directions, rivers, lakes, and coastline masks.
3. **Climate estimation** layers temperature, precipitation, and moisture derived from elevation, latitude, hydrology, and atmospheric parameters.
4. **Biome classification** evaluates climate and hydrology fields to assign biome IDs, applying smoothing filters to prevent speckle.
5. **Rendering** translates biome IDs and hydrology overlays into pixel colors, using a color-blind-safe palette and optional contour lines.

Each stage feeds the next (`elevation → hydrology → climate → biomes → renderer`), ensuring clear separation of concerns and straightforward debugging.

## Determinism Plan

All procedural steps will derive randomness from a single seeded RNG provided by `src/noise.js`. Supplying the same seed (via the UI or preset JSON) will regenerate identical terrain, satisfying the determinism requirements outlined in `AGENTS.md`. Export/import routines will persist the seed, parameter packs, and version metadata so future runs can reproduce results bit-for-bit.

Determinism via Mulberry32; same seed ⇒ identical raster.
