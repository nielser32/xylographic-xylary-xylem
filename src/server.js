import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';

import {
  addFileRecord,
  createItem,
  getFileById,
  getFilesForItem,
  getItemById,
  listItemsWithFiles,
} from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
const uploadRoot = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '../uploads');

fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadRoot);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/items', (_req, res) => {
  const items = listItemsWithFiles();
  res.json(items);
});

app.get('/api/items/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid item id' });
  }
  const item = getItemById(id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  const files = getFilesForItem(id);
  return res.json({ ...item, files });
});

app.post('/api/items', (req, res) => {
  const { title, description = null } = req.body ?? {};
  if (!title || typeof title !== 'string') {
    return res.status(400).json({ error: 'Title is required' });
  }
  const item = createItem({ title: title.trim(), description });
  return res.status(201).json({ ...item, files: [] });
});

app.post('/api/uploads', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File is required' });
  }

  const itemIdValue = req.body?.itemId;
  let itemId = null;

  if (itemIdValue !== undefined && itemIdValue !== null && itemIdValue !== '') {
    const parsed = Number.parseInt(itemIdValue, 10);
    if (Number.isNaN(parsed)) {
      return res.status(400).json({ error: 'Invalid item id' });
    }
    const item = getItemById(parsed);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    itemId = parsed;
  }

  const fileBuffer = fs.readFileSync(req.file.path);
  const fileRecord = addFileRecord({
    itemId,
    originalName: req.file.originalname,
    storedName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    content: fileBuffer,
  });

  return res.status(201).json({
    id: fileRecord.id,
    itemId: fileRecord.itemId,
    originalName: fileRecord.originalName,
    storedName: fileRecord.storedName,
    mimeType: fileRecord.mimeType,
    size: fileRecord.size,
    createdAt: fileRecord.createdAt,
  });
});

app.get('/api/files/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid file id' });
  }
  const fileRecord = getFileById(id);
  if (!fileRecord) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.setHeader('Content-Type', fileRecord.mimeType);
  res.send(fileRecord.content);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export { app };
export default app;
