import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const resolveDatabasePath = () => {
  if (process.env.DB_PATH === ':memory:') {
    return ':memory:';
  }

  if (process.env.DB_PATH) {
    return path.resolve(process.env.DB_PATH);
  }

  return path.resolve(__dirname, '..', 'data', 'app.db');
};

const databasePath = resolveDatabasePath();

if (databasePath !== ':memory:') {
  const dbDirectory = path.dirname(databasePath);
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }
}

const db = new Database(databasePath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    content BLOB NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );
`);

const formatItemRow = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  createdAt: row.created_at,
});

const formatFileRow = (row) => ({
  id: row.id,
  itemId: row.item_id,
  originalName: row.original_name,
  storedName: row.stored_name,
  mimeType: row.mime_type,
  size: row.size,
  createdAt: row.created_at,
  content: row.content,
});

export const createItem = ({ title, description = null }) => {
  const stmt = db.prepare(
    'INSERT INTO items (title, description) VALUES (@title, @description)',
  );
  const info = stmt.run({ title, description });
  return getItemById(info.lastInsertRowid);
};

export const getItemById = (id) => {
  const stmt = db.prepare('SELECT * FROM items WHERE id = ?');
  const row = stmt.get(id);
  return row ? formatItemRow(row) : null;
};

export const listItems = () => {
  const stmt = db.prepare('SELECT * FROM items ORDER BY created_at DESC');
  return stmt.all().map(formatItemRow);
};

export const listItemsWithFiles = () => {
  const items = listItems();
  const filesStmt = db.prepare(
    `SELECT id, item_id, original_name, stored_name, mime_type, size, created_at
     FROM files WHERE item_id = ? ORDER BY created_at DESC`,
  );
  return items.map((item) => ({
    ...item,
    files: filesStmt.all(item.id).map((file) => ({
      id: file.id,
      itemId: file.item_id,
      originalName: file.original_name,
      storedName: file.stored_name,
      mimeType: file.mime_type,
      size: file.size,
      createdAt: file.created_at,
    })),
  }));
};

export const addFileRecord = ({
  itemId = null,
  originalName,
  storedName,
  mimeType,
  size,
  content,
}) => {
  const stmt = db.prepare(
    `INSERT INTO files (item_id, original_name, stored_name, mime_type, size, content)
     VALUES (@itemId, @originalName, @storedName, @mimeType, @size, @content)`,
  );
  const info = stmt.run({
    itemId,
    originalName,
    storedName,
    mimeType,
    size,
    content,
  });
  return getFileById(info.lastInsertRowid);
};

export const getFileById = (id) => {
  const stmt = db.prepare('SELECT * FROM files WHERE id = ?');
  const row = stmt.get(id);
  return row ? formatFileRow(row) : null;
};

export const getFilesForItem = (itemId) => {
  const stmt = db.prepare(
    `SELECT id, item_id, original_name, stored_name, mime_type, size, created_at
     FROM files WHERE item_id = ? ORDER BY created_at DESC`,
  );
  return stmt.all(itemId).map((file) => ({
    id: file.id,
    itemId: file.item_id,
    originalName: file.original_name,
    storedName: file.stored_name,
    mimeType: file.mime_type,
    size: file.size,
    createdAt: file.created_at,
  }));
};

export const clearDatabase = () => {
  db.exec('DELETE FROM files; DELETE FROM items;');
};

export default db;
