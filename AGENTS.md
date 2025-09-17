# AGENTS.md — Procedural Worldgen Web App (Canvas)

## Scope
Generate a believable large-scale terrain tile map on HTML <canvas> with multiple biomes and hydrology. Vanilla JavaScript only.

## Repo layout contract
- index.html
- src/{main.js, ui.js, render.js, worldgen.js, noise.js, biomes.js}
- assets/tiles.png  (placeholder)
- presets/temperate_hemisphere.json
- docs/{AGENTS.md, TASKS.md, ARCHITECTURE.md}

## How to operate
Paste one Agent Prompt at a time into ChatGPT Codex. Follow order. Log deviations in docs/TASKS.md.

## Global constraints
- Determinism: seeded RNG (random number generator). Same seed ⇒ same world.
- No external libraries. Canvas 2D only.
- Grid: 512×512 tiles, tileSize=4 px.
- Performance target: ≥30 FPS (frames per second) while panning.
- Document parameters at the top of each module.

## Acceptance criteria (AC)
- AC1 Seed reproducibility across runs and machines.
- AC2 Rivers start high, flow downhill, merge, and terminate in lakes or ocean.
- AC3 Wetlands cluster in floodplains and lake margins.
- AC4 Climate bands vary with latitude and elevation; transitions are smooth.
- AC5 ≥8 distinct biomes present; no single biome >40% coverage.

## Parameter pack (defaults)
- grid: 512×512, tile: 4 px
- noise (FBM = fractal Brownian motion): octaves=6, lacunarity=2.0, gain=0.5, baseFreq=0.0015
- elevation range: −1000…3000 m; sea level = 0 m
- lapse rate: −6.5 °C/km
- prevailing wind: 270°→90° (west→east)
- rainShadow=0.5
- riverThreshold=200 cells
- wetland rule: slope<2°, moisture>0.7, within 3 tiles of water
- contour interval: 50 m

## Biome legend
tundra; taiga (boreal coniferous forest); deciduous_forest; mixed_forest_steppe; steppe/grassland; shrub_steppe; grassland_forest_transition; wetland/marsh/bog; lowland; upland; highland_forest/mountain_forest; alpine; barren.

---

## Agent: Scaffold
Prompt:
- Create index.html and /src/{main.js, ui.js, render.js, worldgen.js, noise.js, biomes.js}.
- Full-window canvas and a minimal control bar: seed input, Regenerate, layer toggles.
- Wire bootstrap in main.js; place TODO stubs in other modules.
- Vanilla JS only.

## Agent: Noise + RNG
Prompt:
- Implement /src/noise.js: Mulberry32(seed) RNG and 2D Simplex FBM.
- Export noise2D(x,y,{octaves,lacunarity,gain,frequency}).
- Include a comment snippet showing same seed ⇒ same samples.

## Agent: Elevation field
Prompt:
- In /src/worldgen.js export makeElevation(w,h,seed).
- Combine FBM with a continental mask (land:ocean ≈30:70).
- Normalize to [0,1]; map to meters with sea=0, median land ≈400 m, max ≈3000 m.
- Return Float32Array elevation.

## Agent: Hydrology
Prompt:
- Compute D8 (eight-neighbor) flow directions and flow accumulation.
- Use priority-flood depression filling to resolve basins.
- Mark rivers where accumulation ≥200 and local downslope exists; compute Strahler order and widen by order.
- Create lakes in depressions; compute coastline mask.
- Return {rivers:Boolean[], lakes:Boolean[], coastline:Boolean[]}.

## Agent: Climate + Moisture
Prompt:
- Export makeClimate(w,h,elev,seed,opts).
- Temperature: latitude gradient + elevation lapse (−6.5 °C/km) + noise.
- Precipitation: prevailing wind W→E with orographic lift and leeward shadow + noise.
- Moisture: blend of precipitation and inverse distance to water (rivers, lakes, coast).
- Return {temp, precip, moisture} as Float32Arrays.

## Agent: Biomes
Prompt:
- In /src/biomes.js export classify(elev_m, temp_C, precip_mm, moisture, flags) → biome id from the legend.
- Use a thresholds table; apply a 3×3 mode filter to reduce speckle.
- Return Uint8Array of biome ids and a legend map.

## Agent: Renderer
Prompt:
- In /src/render.js build a CB-safe (color-blind-safe) 8-color biome LUT (lookup table).
- Draw order: ocean → land biomes → wetlands overlay → rivers → lakes → coastline → contours (marching squares, 50 m).
- Prebake an RGBA buffer (Uint8ClampedArray) and blit via putImageData.
- Implement pan/zoom; render at devicePixelRatio; snap blit to integer device pixels to avoid shimmer.

## Agent: UI + Debug
Prompt:
- In /src/ui.js add seed box, Regenerate, layer toggles, FPS meter.
- Keys 1–4: preview elevation, temperature, precipitation, moisture.
- Emit events consumed by main.js to rebuild or toggle overlays.

## Agent: QA (quality assurance)
Prompt:
- Determinism: “Regen ×10” with fixed seed; FNV-1a hash of pixel buffer must match.
- Hydrology: pick N random river cells; downstream path must reach ocean or lake ≤10k steps; log any violations.
- Coverage: print biome histogram and Shannon diversity index; expect ≥8 classes and ≤40% for any single class.

## Agent: Export/Import
Prompt:
- Buttons: Export PNG and Export JSON containing {seed, all params, params_version}.
- Import JSON to reproduce a world. Refuse import on mismatched params_version unless “force replay” is enabled.

---

## Alignment hardening

Rendering and export:
- Default map is edge-to-edge with no decorative frame. marginPx controls optional margins (default 0).
- Export modes: png_frameless and png_with_margin; embed DPI metadata.
- Always render at window.devicePixelRatio and snap the final blit to integer device pixels.

Color management:
- White point D65; forbid global grading/filters. Use per-region colors only.
- Document the CB-safe palette in the LUT.

Biome coverage targets:
- Wetland/marsh/bog expected ≥10% in suitable climates; warn if <5%.
- Enforce ≤40% for any single biome and warn on breach.

Determinism and replay:
- Export {seed, params_version, all knobs}. Bump params_version on schema changes.
- Cross-version runs must match version or require explicit force replay.

Hydrology assertions:
- D8 flow is acyclic; every river cell resolves to ocean or lake within 10k steps.
- After depression filling, log any residual closed basins.

Performance guardrails:
- Maintain ≥30 FPS during pan at 1×. If frame time >24 ms, auto-simplify (disable contours or reduce tile size).

Labels:
- Label layer disabled by default. Add only after visual QA passes.

---

## Minimal fallback (recovery)
Prompt:
- Create a 256×256 canvas map.
- Seeded Simplex elevation. Classes: water, beach, plains, forest, mountain.
- Draw colored rects. Seed input + Regenerate. No libraries.
