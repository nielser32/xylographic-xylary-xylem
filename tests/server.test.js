process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xyl-uploads-'));
process.env.UPLOAD_DIR = uploadsDir;

const { app } = await import('../src/server.js');
const dbModule = await import('../src/db.js');
const { clearDatabase, getFileById } = dbModule;

beforeEach(() => {
  clearDatabase();
});

after(() => {
  fs.rmSync(uploadsDir, { recursive: true, force: true });
});

test('POST /api/items creates a new item', async () => {
  const response = await request(app)
    .post('/api/items')
    .send({ title: 'Test Item', description: 'A description' });

  assert.equal(response.status, 201);
  assert.equal(response.body.title, 'Test Item');
  assert.equal(response.body.description, 'A description');
  assert.ok(response.body.id, 'Expected an ID to be generated');
  assert.deepEqual(response.body.files, []);
});

test('POST /api/uploads stores file metadata and content', async () => {
  const itemResponse = await request(app)
    .post('/api/items')
    .send({ title: 'File owner' });

  const buffer = Buffer.from('Hello uploads');

  const uploadResponse = await request(app)
    .post('/api/uploads')
    .field('itemId', String(itemResponse.body.id))
    .attach('file', buffer, {
      filename: 'hello.txt',
      contentType: 'text/plain',
    });

  assert.equal(uploadResponse.status, 201);
  assert.equal(uploadResponse.body.originalName, 'hello.txt');
  assert.equal(uploadResponse.body.itemId, itemResponse.body.id);
  assert.ok(uploadResponse.body.id, 'Expected file ID to be generated');

  const storedFile = getFileById(uploadResponse.body.id);
  assert.equal(storedFile.size, buffer.length);
  assert.equal(storedFile.mimeType, 'text/plain');
  assert.deepEqual(storedFile.content, buffer);
});

test('GET /api/items retrieves items with associated files', async () => {
  const itemResponse = await request(app)
    .post('/api/items')
    .send({ title: 'Parent item' });

  const buffer = Buffer.from('File contents for retrieval');

  await request(app)
    .post('/api/uploads')
    .field('itemId', String(itemResponse.body.id))
    .attach('file', buffer, {
      filename: 'notes.txt',
      contentType: 'text/plain',
    });

  const listResponse = await request(app).get('/api/items');

  assert.equal(listResponse.status, 200);
  assert.ok(Array.isArray(listResponse.body));

  const retrieved = listResponse.body.find((item) => item.id === itemResponse.body.id);
  assert.ok(retrieved, 'Expected item to be present in list response');
  assert.equal(retrieved.files.length, 1);
  assert.equal(retrieved.files[0].originalName, 'notes.txt');
});
