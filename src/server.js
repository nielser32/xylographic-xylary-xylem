const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '-');
    cb(null, `${timestamp}-${sanitized}`);
  }
});

const upload = multer({ storage });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    asset_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const insertItem = db.prepare(
  'INSERT INTO items (title, description, asset_path) VALUES (?, ?, ?)' 
);
const selectAllItems = db.prepare(
  'SELECT id, title, description, asset_path, created_at FROM items ORDER BY created_at DESC'
);
const selectItemById = db.prepare(
  'SELECT id, title, description, asset_path, created_at FROM items WHERE id = ?'
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(PUBLIC_DIR));

app.get('/api/items', (_req, res) => {
  const items = selectAllItems.all();
  res.json({ items });
});

app.get('/api/items/:id', (req, res) => {
  const item = selectItemById.get(Number(req.params.id));
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json({ item });
});

app.post('/api/items', upload.single('asset'), (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const assetPath = req.file ? path.posix.join('/uploads', req.file.filename) : null;
    const result = insertItem.run(title, description || null, assetPath);
    const item = selectItemById.get(result.lastInsertRowid);

    res.status(201).json({ item });
  } catch (error) {
    next(error);
  }
});

app.get(/^(?!\/(api|uploads)).*/, (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
