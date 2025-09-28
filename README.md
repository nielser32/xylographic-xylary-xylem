# Introduction

Welcome to **Xylographic Xylary Xylem**, a human-centered knowledge atlas built on a Node.js and Express backend. The experience combines secure file uploads with persistent SQLite storage, making every contribution instantly available across the interface.

The single-page application presents every artifact on a canvas-driven, force-directed graph. Selecting a node opens its rich content inline, reinforcing the law-of-UX-inspired focus on minimizing cognitive load while keeping context at hand. This uninterrupted flow honors the project's human-centered design goals.

A dark, terminal-ricing-inspired Tailwind CSS theme surrounds the graph with deep charcoal gradients that still meet WCAG AA contrast targets. Accent colors pulse across interactive states, focus rings, and data highlights, ensuring accessibility and aesthetic cohesion in equal measure.

## Prerequisites

- **Node.js** 20 LTS (or newer) and **npm**.
- SQLite is bundled via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3), so no external database server is required.
- Optional: set `UPLOAD_DIR` or `DB_PATH` environment variables if you want to override the default upload and database locations.

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Copy `.env.example` to `.env` and adjust `UPLOAD_DIR`, `DB_PATH`, or any future configuration knobs.

## Running the development server

Start the API and static asset server with hot reloading:

```bash
npm run dev
```

By default the Express app listens on `http://localhost:3000`. Adjust `PORT` or other environment variables in your `.env` file to customize the runtime.

## Building Tailwind assets

Tailwind styles live in `src/styles/tailwind.css`. To generate the optimized stylesheet consumed by the app, run:

```bash
npm run build:css
```

The build outputs `public/styles.css`. Re-run this command whenever you change Tailwind inputs, or wire it into your watch scripts if you prefer live rebuilding.

## Tests and lints

Automated tests use Node's built-in test runner:

```bash
npm test
```

A placeholder lint script is available to plug in future static analysis steps:

```bash
npm run lint
```

## API reference

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/health` | Lightweight health probe that returns `{ status: "ok" }` for uptime checks. |
| `GET` | `/api/items` | Lists every item with its associated file metadata sorted by recency. |
| `GET` | `/api/items/:id` | Retrieves a single item by ID along with its related files. Responds with `400` for invalid IDs and `404` when missing. |
| `POST` | `/api/items` | Creates a new knowledge item. Requires a `title` (string) and accepts an optional `description`. Returns the stored entity with an empty `files` array. |
| `POST` | `/api/uploads` | Accepts multipart form data with a `file` field and an optional `itemId`. Persists both the on-disk artifact and a database record linked to the target item. |
| `GET` | `/api/files/:id` | Streams the stored binary content for a file record, setting the saved MIME type on the response. |

### Upload pipeline and persistence

Uploads are managed by Multer's disk storage engine, which writes files into `UPLOAD_DIR` (defaulting to `uploads/` in the repo). Once a file lands on disk, the server reads its bytes and inserts a record into SQLite with the metadata, blob content, and optional `itemId` foreign key. Files can therefore be fetched later directly from the database, while the on-disk copy provides a redundant cache you can retain or rotate out-of-band. Configure the persistence path by setting `UPLOAD_DIR` for the filesystem location and `DB_PATH` for the SQLite file location (use `:memory:` for ephemeral tests).

## Force-directed UI architecture

The front end renders a force-directed constellation on an HTML canvas (`public/app.js`). Items from `/api/items` are normalized into a central "Atlas Core" anchor node plus a node per item, with spring links holding the constellation together. A lightweight physics loop applies repulsive forces, spring tension, and centering pressure to animate the layout while respecting reduced-motion preferences.

Each node maintains metadata (`title`, `description`, `files`) so selections can hydrate the detail panel without additional requests. To extend the visualization:

- Add new visual encodings inside `draw()` for size, color, or glyphs based on incoming item attributes.
- Introduce additional link types by expanding `createNodes()` to generate bespoke link arrays.
- Layer in interactions by wiring pointer events (`pointermove`, `click`, etc.) to update shared `state` or dispatch requests for richer item payloads.

This structure keeps the simulation deterministic, keeps data flow centralized in the `state` object, and makes it straightforward to plug new datasets or interaction affordances into the graph.

## Storage expectations for contributors

When authoring backend features, assume items and files are persisted via SQLite with foreign-key relationships and cascading deletes. The existing helper functions in `src/db.js` handle inserts, lookups, and joins for common scenarios—reuse them when possible to keep schema interactions consistent. All file metadata and binary content live in the database, so additional ingestion pipelines should either hook into `addFileRecord` or provide an equivalent that respects the same structure (`originalName`, `storedName`, `mimeType`, `size`, `content`).

