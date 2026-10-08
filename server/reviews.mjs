import { MongoClient } from 'mongodb';

// What reviewers say about the things a search result never carries: quiet, noise, wifi, charging.
// One SerpApi Google Maps Reviews call per place returns Google's review topics (with mention counts)
// and the most relevant recent reviews; results are cached per place so repeat searches cost nothing.
const SIGNALS = [
  { key: 'quiet', label: 'Quiet', words: /\b(peaceful|quiet|silent|silence|calm)\b/i },
  { key: 'noisy', label: 'Crowds or noise', words: /\b(noisy|noise|loud|crowded|crowd|rush)\b/i },
  { key: 'study', label: 'Studying', words: /\b(study|studying|exams?|reading room|students)\b/i },
  { key: 'wifi', label: 'Wi-Fi', words: /\b(wi-?fi|internet)\b/i },
  { key: 'power', label: 'Charging points', words: /\b(charging|plug points?|sockets?|power points?)\b/i },
];
const FRESH_MS = 14 * 86400000;
const memory = new Map();
let collection;
const store = () => collection ||= process.env.MONGODB_URI
  ? new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).connect()
    .then(client => client.db(process.env.MONGODB_DATABASE || 'sidequest').collection('reviews'))
  : Promise.resolve(null);

function excerpt(text, match) {
  const at = Math.max(0, match.index - 60);
  const piece = text.slice(at, at + 150).replace(/\s+/g, ' ').trim();
  return `${at ? '…' : ''}${piece}${at + 150 < text.length ? '…' : ''}`;
}

export function reviewEvidence(data) {
  const topics = (data.topics || []).map(t => ({ keyword: String(t.keyword), mentions: Number(t.mentions) || 0 }));
  const reviews = (data.reviews || []).map(r => ({ text: String(r.snippet || r.extracted_snippet?.original || ''), link: r.link || null }))
    .filter(r => r.text);
  const signals = SIGNALS.map(s => {
    const fromTopics = topics.filter(t => s.words.test(t.keyword)).reduce((sum, t) => sum + t.mentions, 0);
    const hits = reviews.map(r => ({ r, m: s.words.exec(r.text) })).filter(h => h.m);
    const first = hits[0];
    return { key: s.key, label: s.label, mentions: fromTopics + hits.length,
      ...(first ? { quote: excerpt(first.r.text, first.m), link: first.r.link } : {}) };
  }).filter(s => s.mentions > 0).sort((a, b) => b.mentions - a.mentions);
  return { signals, topics: topics.slice(0, 6), reviewed: reviews.length, fetchedAt: new Date().toISOString() };
}

async function cached(placeId) {
  const hit = memory.get(placeId) || await (await store())?.findOne({ _id: placeId });
  return hit && Date.now() - Date.parse(hit.fetchedAt) < FRESH_MS ? hit : null;
}

async function remember(placeId, evidence) {
  memory.set(placeId, evidence);
  await (await store())?.replaceOne({ _id: placeId }, { _id: placeId, ...evidence }, { upsert: true });
}

export async function evidenceFor(candidate, key, fetcher = fetch) {
  if (!candidate.dataId || !candidate.placeId) return null;
  const hit = await cached(candidate.placeId);
  if (hit) { const { _id, ...evidence } = hit; return evidence; }
  const url = new URL('https://serpapi.com/search.json');
  url.search = new URLSearchParams({ engine: 'google_maps_reviews', data_id: candidate.dataId, hl: 'en', api_key: key }).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;
  const data = await response.json();
  if (data.error) return null;
  const evidence = reviewEvidence(data);
  await remember(candidate.placeId, evidence);
  return evidence;
}

export async function attachReviews(candidates, key, fetcher = fetch) {
  await Promise.all(candidates.map(async c => {
    try { const evidence = await evidenceFor(c, key, fetcher); if (evidence?.signals.length) c.evidence = evidence; }
    catch { /* reviews are optional; the option stands without them */ }
  }));
  return candidates;
}
