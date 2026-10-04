import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { MongoClient } from 'mongodb';

export async function createStore({ mongoUri = process.env.MONGODB_URI, file = '.data/sidequest.db' } = {}) {
  if (mongoUri) {
    const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    const collection = client.db(process.env.MONGODB_DATABASE || 'sidequest').collection('outings');
    return {
      kind: 'MongoDB Atlas',
      async get(id) { const doc = await collection.findOne({ _id: id }); if (!doc) return null; const { _id, ...data } = doc; return data; },
      async insert(doc) { await collection.insertOne({ _id: doc.id, ...doc }); },
      async save(doc, revision) { const result = await collection.replaceOne({ _id: doc.id, revision }, { _id: doc.id, ...doc, revision: revision + 1 }); return result.modifiedCount === 1; },
      async close() { await client.close(); },
    };
  }
  const ephemeral = process.env.NODE_ENV === 'production' && process.env.ALLOW_EPHEMERAL_DEMO === 'true';
  if (process.env.NODE_ENV === 'production' && !ephemeral) throw new Error('MONGODB_URI is required in production; local storage is not durable on Render.');
  if (ephemeral) file = ':memory:';
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS outings (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, body TEXT NOT NULL)');
  return {
    kind: ephemeral ? 'temporary demo' : 'local SQLite', ephemeral,
    async get(id) { const row = db.prepare('SELECT body FROM outings WHERE id = ?').get(id); return row ? JSON.parse(row.body) : null; },
    async insert(doc) { db.prepare('INSERT INTO outings VALUES (?, ?, ?)').run(doc.id, doc.revision, JSON.stringify(doc)); },
    async save(doc, revision) { return db.prepare('UPDATE outings SET revision = ?, body = ? WHERE id = ? AND revision = ?').run(revision + 1, JSON.stringify({ ...doc, revision: revision + 1 }), doc.id, revision).changes === 1; },
    async close() { db.close(); },
  };
}
