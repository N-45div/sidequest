import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { retrieveVenues, indexVenues } from './venue-index.mjs';

export const preferenceSchema = z.object({
  budget: z.number().int().min(0).max(100000),
  start: z.number().int().min(0).max(1439),
  end: z.number().int().min(1).max(1440),
  interests: z.array(z.enum(['library', 'campus', 'coworking', 'coffee', 'outdoors', 'food', 'games', 'art'])).min(1).max(8),
  quiet: z.boolean(), stepFree: z.boolean(),
}).refine(p => p.end > p.start, { message: 'End time must be after start time.' });

const activities = [
  { name: 'Library revision session', subtitle: 'Quiet individual work with a shared revision break.', category: 'library', cost: 0, duration: 90, quiet: true, stepFree: true, tone: 'library' },
  { name: 'Campus problem-solving circle', subtitle: 'Work through a problem set with your classmates.', category: 'campus', cost: 0, duration: 120, quiet: true, stepFree: true, tone: 'campus' },
  { name: 'Study cafe session', subtitle: 'Compare notes over a drink after lectures.', category: 'coffee', cost: 150, duration: 90, quiet: true, stepFree: true, tone: 'coffee' },
  { name: 'Shared coworking study desk', subtitle: 'A desk for a focused group revision session.', category: 'coworking', cost: 300, duration: 120, quiet: true, stepFree: true, tone: 'coworking' },
  { name: 'Outdoor flashcard review', subtitle: 'A short peer quiz in an open study spot.', category: 'outdoors', cost: 0, duration: 90, quiet: false, stepFree: false, tone: 'outdoors' },
];

export function rankCandidates(venues, preferences) {
  if (!preferences.length) return [];
  const start = Math.max(...preferences.map(p => p.start));
  const end = Math.min(...preferences.map(p => p.end));
  return venues.filter(v =>
    start + v.duration <= end &&
    preferences.every(p => (v.cost == null || v.cost <= p.budget) && (!p.quiet || v.quiet !== false) && (!p.stepFree || v.stepFree !== false))
  ).map(v => ({ ...v, start, score: preferences.reduce((sum, p) => sum + Number(p.interests.includes(v.category)), 0) }))
    .sort((a, b) => b.score - a.score || (a.cost ?? Infinity) - (b.cost ?? Infinity))
    .slice(0, 3).map(({ score, ...v }) => ({
      ...v, id: randomUUID(),
      reason: score ? 'Matches interests shared by the group.' : 'An alternative within the known group constraints.',
    }));
}

export function sampleCandidates(preferences) {
  return rankCandidates(activities.map(v => ({ ...v, sample: true, source: null, uncertainties: ['Illustrative study space and cost; campus access and real venue details have not been verified.'] })), preferences);
}

export async function discoverLive(city, preferences, key) {
  const categories = [...new Set(preferences.flatMap(p => p.interests))].slice(0, 3);
  // Retrieval is optional; search still works if the index is unavailable.
  let indexed = [];
  try { indexed = await retrieveVenues(city, categories); } catch { /* redacted tool span records failure */ }
  const responses = await Promise.all(categories.map(async category => {
    const url = new URL('https://serpapi.com/search.json');
    url.search = new URLSearchParams({ engine: 'google_maps', q: `${({ library: 'public libraries with study space', campus: 'university libraries study rooms', coworking: 'coworking study spaces', coffee: 'cafes for studying', outdoors: 'quiet parks for studying' })[category] || 'study spaces'} in ${city}`, type: 'search', api_key: key }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Venue search is unavailable. Try again shortly.');
    const data = await response.json();
    if (data.error) throw new Error('Venue search could not complete. Check the search account configuration.');
    return (data.local_results || []).slice(0, 5).map(v => ({
      name: String(v.title || 'Unnamed venue').slice(0, 120), subtitle: String(v.address || city).slice(0, 200),
      category, cost: null, duration: 90, quiet: null, stepFree: null, tone: category,
      sample: false, source: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${v.title} ${v.address || city}`)}`,
      retrievedAt: new Date().toISOString(),
      uncertainties: ['Cost, study suitability, date-specific hours, noise, campus visitor eligibility and step-free access need confirmation before studying here.'],
    }));
  }));
  const unique = [...new Map(responses.flat().map(v => [v.name + v.subtitle, v])).values()];
  try { await indexVenues(city, unique); } catch { /* optional indexing must not discard live results */ }
  const merged = new Map([...indexed, ...unique].map(v => [v.name + v.subtitle, v]));
  return rankCandidates([...merged.values()], preferences);
}

// Shared with scripts/tinker_study.py, which trains and scores the model on this exact prompt.
const extractionPrompt = readFileSync(new URL('./extraction-prompt.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n').trim();
const spaces = ['library', 'campus', 'coworking', 'coffee', 'outdoors'];
const clock = minute => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const minutesOf = value => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value));
  if (!match) throw new Error('Invalid time.');
  return Number(match[1]) * 60 + Number(match[2]);
};
const turn = (role, text) => `<|im_start|>${role}\n${text}<|im_end|>\n`;

// Qwen chat format with thinking disabled, rendered here so serving matches training token for token.
export function renderExtraction(text, defaults) {
  const shown = { budget: defaults.budget, start: clock(defaults.start), end: clock(defaults.end),
    spaces: defaults.interests.filter(i => spaces.includes(i)), quiet: defaults.quiet, stepFree: defaults.stepFree };
  if (!shown.spaces.length) shown.spaces = ['library'];
  return turn('system', extractionPrompt.replace('{defaults}', JSON.stringify(shown)))
    + turn('user', text.replaceAll('<|', '<')) + '<|im_start|>assistant\n<think>\n\n</think>\n\n';
}

export async function extractPreferences(text, defaults, fetcher = fetch) {
  const base = process.env.MODEL_BASE_URL;
  if (!base || !process.env.MODEL_NAME) throw new Error('AI interpretation is not connected yet. Use the private preference controls below.');
  const response = await fetcher(`${base.replace(/\/$/, '')}/completions`, {
    method: 'POST', signal: AbortSignal.timeout(25000),
    headers: { 'Content-Type': 'application/json', ...(process.env.MODEL_API_KEY ? { Authorization: `Bearer ${process.env.MODEL_API_KEY}` } : {}) },
    body: JSON.stringify({ model: process.env.MODEL_NAME, prompt: renderExtraction(text, defaults), max_tokens: 160, temperature: 0, stop: ['<|im_end|>'] }),
  });
  if (!response.ok) throw new Error('The model is unavailable. Your preferences have not changed.');
  const data = await response.json();
  const draft = JSON.parse(/\{[\s\S]*\}/.exec(data.choices?.[0]?.text || '')?.[0] || 'null');
  if (!draft || !Array.isArray(draft.spaces)) throw new Error('Invalid draft.');
  return preferenceSchema.parse({ budget: draft.budget, start: minutesOf(draft.start), end: minutesOf(draft.end),
    interests: draft.spaces, quiet: draft.quiet, stepFree: draft.stepFree });
}

export function toCalendar(group, candidate) {
  // Outings currently use Asia/Kolkata; UTC conversion does not depend on host timezone.
  const instant = minute => new Date(`${group.date}T00:00:00+05:30`).getTime() + minute * 60000;
  const stamp = minute => new Date(instant(minute)).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = value => String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SideQuest//EN', 'BEGIN:VEVENT', `UID:${group.id}@sidequest`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART:${stamp(candidate.start)}`, `DTEND:${stamp(candidate.start + candidate.duration)}`,
    `SUMMARY:${escape(group.title)}`, `LOCATION:${escape(candidate.name + ', ' + group.city)}`,
    `DESCRIPTION:${escape(candidate.uncertainties.join(' '))}`, 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}
