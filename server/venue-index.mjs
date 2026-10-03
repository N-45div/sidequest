import pg from 'pg';
import { createHash } from 'node:crypto';
import { trace } from './telemetry.mjs';
let pool;
const database = () => pool ||= new pg.Pool({ connectionString: process.env.TIGER_DATABASE_URL,
  max: 3, connectionTimeoutMillis: 5000, statement_timeout: 10000 });
export function vectorLiteral(values) {
  if (!Array.isArray(values) || values.length !== 384 || !values.every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error('Expected a finite 384-dimensional embedding.');
  return `[${values.join(',')}]`;
}
async function embed(text) {
  if (!process.env.EMBEDDING_BASE_URL || !process.env.EMBEDDING_MODEL) throw new Error('Embedding endpoint is not configured.');
  const response = await fetch(`${process.env.EMBEDDING_BASE_URL.replace(/\/$/, '')}/embeddings`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(process.env.EMBEDDING_API_KEY ? { Authorization: `Bearer ${process.env.EMBEDDING_API_KEY}` } : {}) },
    body: JSON.stringify({ model: process.env.EMBEDDING_MODEL, input: text }),
  });
  if (!response.ok) throw new Error('Embeddings unavailable.');
  return vectorLiteral((await response.json()).data?.[0]?.embedding);
}
export const hybridQuery = `WITH eligible AS (
  SELECT * FROM sidequest_venues WHERE city = $1 AND category = ANY($2::text[])
    AND retrieved_at > now() - interval '30 days'
), lexical AS (
  SELECT id, row_number() OVER (ORDER BY ts_rank_cd(search_document, plainto_tsquery('english', $3)) DESC, id) AS rank
  FROM eligible WHERE search_document @@ plainto_tsquery('english', $3) LIMIT 30
), semantic AS (
  SELECT id, row_number() OVER (ORDER BY embedding <=> $4::vector, id) AS rank
  FROM eligible ORDER BY embedding <=> $4::vector LIMIT 30
), fused AS (
  SELECT id, sum(score) AS score FROM (
    SELECT id, 1.0 / (60 + rank) AS score FROM lexical UNION ALL
    SELECT id, 1.0 / (60 + rank) AS score FROM semantic
  ) ranks GROUP BY id
)
SELECT v.payload FROM fused JOIN eligible v USING(id) ORDER BY fused.score DESC, v.id LIMIT 15`;
export async function retrieveVenues(city, categories) {
  if (!process.env.TIGER_DATABASE_URL) return [];
  return trace('gen_ai.execute_tool', 'tigerdata', async () => {
    // Only city and public activity categories leave the process, never budgets
    // or individual access/noise requirements.
    const query = categories.join(' ');
    const result = await database().query(hybridQuery, [city.trim().toLowerCase(), categories, query, await embed(query)]);
    return result.rows.map(row => row.payload);
  });
}
export async function indexVenues(city, venues) {
  if (!process.env.TIGER_DATABASE_URL) return;
  await trace('gen_ai.execute_tool', 'tigerdata', async () => {
    // Bound inference calls; the first three fresh venues warm the corpus.
    await Promise.all(venues.slice(0, 3).map(async venue => {
      const text = `${venue.name} ${venue.subtitle} ${venue.category}`;
      const vector = await embed(text);
      const id = createHash('sha256').update(`${city.trim().toLowerCase()}|${venue.name}|${venue.subtitle}`).digest('hex');
      await database().query(`INSERT INTO sidequest_venues(id,city,category,content,payload,embedding,retrieved_at)
        VALUES($1,$2,$3,$4,$5::jsonb,$6::vector,$7::timestamptz)
        ON CONFLICT(id) DO UPDATE SET category=excluded.category,content=excluded.content,payload=excluded.payload,
          embedding=excluded.embedding,retrieved_at=excluded.retrieved_at`,
      [id, city.trim().toLowerCase(), venue.category, text, JSON.stringify(venue), vector, venue.retrievedAt]);
    }));
  });
}
