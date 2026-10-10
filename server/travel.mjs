// How far each shortlisted place is for the group. One SerpApi Google Maps Directions search per starting area
// and place returns the time for every way of travelling at once (car, two-wheeler, bus or metro, walking), so
// members who start from the same area share it. Only the group's longest trip and how many people it puts over
// their own limit leave this module: who starts where, and how they travel, stays private.
export const MODES = { transit: 'Transit', 'two-wheeler': 'Two-wheeler', driving: 'Driving', walking: 'Walking' };
const FRESH_MS = 14 * 86400000;
const memory = new Map();

// Traffic and bus or metro timetables depend on when you leave, so trips are timed for the session, not for now
export function departure(date, start) {
  return date ? Math.floor(Date.parse(`${date}T00:00:00+05:30`) / 1000) + Math.max(0, start - 45) * 60 : null;
}

export async function tripMinutes(from, place, city, key, fetcher = fetch, departAt = null) {
  const target = place.dataId || [place.name, place.subtitle].join('|');
  const cacheKey = `${from.trim().toLowerCase()}|${target}|${departAt ?? 'now'}`;
  const hit = memory.get(cacheKey);
  if (hit && Date.now() - hit.at < FRESH_MS) return hit.minutes;
  const url = new URL('https://serpapi.com/search.json');
  url.search = new URLSearchParams({ engine: 'google_maps_directions', start_addr: `${from.trim()}, ${city}`,
    end_addr: `${place.name}, ${place.subtitle}`, ...(departAt ? { time: `depart_at:${departAt}` } : {}), hl: 'en', gl: 'in', api_key: key }).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) return null;
  const data = await response.json();
  if (data.error) return null;
  const minutes = Object.fromEntries((data.durations || []).map(d => [d.travel_mode, Math.round(Number(d.duration) / 60)]).filter(([, m]) => m > 0));
  memory.set(cacheKey, { minutes, at: Date.now() });
  return minutes;
}

export async function attachTravel(candidates, preferences, city, key, fetcher = fetch, date = null) {
  const travellers = preferences.filter(p => p.from?.trim());
  if (!travellers.length || !key) return candidates;
  // Everyone leaves for the session's start, the latest of the members' free-from times
  const departAt = departure(date, Math.max(...preferences.map(p => p.start)));
  // The same area typed twice is one search, under the spelling first given
  const origins = [...new Map(travellers.map(p => [p.from.trim().toLowerCase(), p.from.trim()]).reverse()).values()];
  await Promise.all(candidates.filter(c => !c.sample).map(async c => {
    const times = new Map(await Promise.all(origins.map(async from =>
      [from.toLowerCase(), await tripMinutes(from, c, city, key, fetcher, departAt).catch(() => null)])));
    const trips = travellers.map(p => ({ minutes: times.get(p.from.trim().toLowerCase())?.[MODES[p.travelMode || 'transit']], limit: p.maxTravel }))
      .filter(t => t.minutes != null);
    if (trips.length) c.travel = { longest: Math.max(...trips.map(t => t.minutes)), over: trips.filter(t => t.limit && t.minutes > t.limit).length,
      known: trips.length, of: preferences.length };
  }));
  // Fairest first: places that keep everyone within their own limit, then the shortest longest trip
  const fair = c => [c.travel?.over ?? 0, c.travel?.longest ?? Infinity];
  return candidates.map((c, i) => ({ c, i })).sort((a, b) => fair(a.c)[0] - fair(b.c)[0] || fair(a.c)[1] - fair(b.c)[1] || a.i - b.i).map(x => x.c);
}
