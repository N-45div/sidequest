// Google Maps lists opening hours per weekday: "10 am–8 pm", "9:30 am–1 pm, 4–8 pm", "Closed", "Open 24 hours".
// A place closed for the whole session is dropped; one confirmed open no longer carries the "hours" unknown.
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const plain = text => String(text || '').replace(/[  ]/g, ' ').replace(/[–—]/g, '-').trim();

function clock(text, suffix) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(text.trim());
  if (!match) return null;
  const half = (match[3] || suffix || '').toLowerCase();
  return { minutes: (Number(match[1]) % 12 + (half === 'pm' ? 12 : 0)) * 60 + Number(match[2] || 0), half };
}

// The open spans of one day in minutes after midnight; [] when closed, null when the text can't be read.
export function openSpans(text) {
  const day = plain(text).toLowerCase();
  if (!day) return null;
  if (day === 'closed') return [];
  if (day.includes('24 hours')) return [[0, 1440]];
  const spans = [];
  for (const part of day.split(',')) {
    const [from, to] = part.split('-').map(s => s?.trim());
    const end = to && clock(to);
    if (!from || !end) return null;
    let start = clock(from, end.half);
    // "11-2 pm" opens at 11 am: a borrowed "pm" that lands after the closing time belongs to the morning
    if (start && !/(am|pm)$/i.test(from) && start.minutes > end.minutes) start = clock(from, 'am');
    if (!start) return null;
    spans.push([start.minutes, end.minutes > start.minutes ? end.minutes : end.minutes + 1440]);
  }
  return spans;
}

// Whether the place is open from `start` for `duration` minutes on `date` (YYYY-MM-DD); null when Google gave no hours.
export function openFor(operatingHours, date, start, duration) {
  if (!operatingHours || !date) return null;
  const day = DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const spans = openSpans(operatingHours[day]);
  if (spans === null) return null;
  return { open: spans.some(([from, to]) => from <= start && start + duration <= to),
    day: day[0].toUpperCase() + day.slice(1), hours: plain(operatingHours[day]).replace(/\s*-\s*/g, '–') };
}
