import pg from 'pg';
import { readFile } from 'node:fs/promises';
if (!process.env.TIGER_DATABASE_URL) throw new Error('Set TIGER_DATABASE_URL in the ignored .env file.');
const client = new pg.Client({ connectionString: process.env.TIGER_DATABASE_URL });
try { await client.connect(); await client.query(await readFile(new URL('../infra/venue-index.sql', import.meta.url), 'utf8')); console.log('Venue index schema installed.'); }
finally { await client.end(); }
