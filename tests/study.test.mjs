import test from 'node:test';
import assert from 'node:assert/strict';
import { preferenceSchema, sampleCandidates, discoverLive, rankCandidates } from '../server/planner.mjs';
import { crowdAt } from '../server/busyness.mjs';
import { reviewEvidence, attachReviews } from '../server/reviews.mjs';
import { openSpans, openFor } from '../server/hours.mjs';
import { attachTravel } from '../server/travel.mjs';

const preferences = { budget:0, start:1020, end:1200, interests:['library','campus'], quiet:true, stepFree:true };
test('study circles support free accessible revision spaces within the shared time window', () => {
  assert.deepEqual(preferenceSchema.parse(preferences), preferences);
  const choices = sampleCandidates([preferences, {...preferences,start:1050}]);
  assert.ok(choices.length > 0);
  assert.ok(choices.every(c => ['library','campus'].includes(c.category) && c.cost === 0 && c.start === 1050 && c.start+c.duration <= 1200));
  assert.ok(choices.every(c => c.sample && c.uncertainties.some(note => note.includes('Illustrative'))));
});
test('live study search requests libraries and keeps campus access and quietness unverified', async t => {
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  const queries = [];
  globalThis.fetch = async url => {
    queries.push(new URL(url).searchParams.get('q'));
    return {ok:true,json:async()=>({local_results:[{title:'Example library',address:'Example city'}]})};
  };
  const results = await discoverLive('Pune',[{...preferences,interests:['library']}],'fixture-key');
  assert.deepEqual(queries,['public libraries with study space in Pune']);
  assert.equal(results[0].quiet,null); assert.equal(results[0].stepFree,null); assert.equal(results[0].cost,null);
  assert.ok(results[0].uncertainties.some(note => note.includes('campus visitor eligibility')));
});
test('busyness forecasts label the session hour and put quieter places first when someone needs quiet', async () => {
  const week = busy => Array.from({ length: 7 }, (_, day) => Array.from({ length: 15 }, (_, h) => day === 1 && h === 9 ? busy : 20));
  const docs = [{ _id: 'busy', source: 'tabpfn', week: week(82) }, { _id: 'calm', source: 'google', week: week(25) }];
  const crowd = await crowdAt(['busy', 'calm'], '2026-10-05', 17 * 60 + 30, async ids => docs.filter(d => ids.includes(d._id)));
  assert.deepEqual(crowd.get('busy'), { score: 82, label: 'Usually busy', source: 'tabpfn', hour: 17 });
  assert.equal(crowd.get('calm').label, 'Usually quiet');
  const venue = id => ({ name: id, subtitle: '', category: 'coffee', cost: null, duration: 90, quiet: null, stepFree: null, uncertainties: [], crowd: crowd.get(id) });
  const person = { budget: 300, start: 1020, end: 1200, interests: ['coffee'], quiet: false, stepFree: false };
  assert.deepEqual(rankCandidates([venue('busy'), venue('calm')], [{ ...person, quiet: true }]).map(c => c.name), ['calm', 'busy']);
  assert.deepEqual(rankCandidates([venue('busy'), venue('calm')], [person]).map(c => c.name), ['busy', 'calm']);
  assert.equal((await crowdAt(['busy'], '2026-10-05', 23 * 60, async () => docs)).size, 0);
});
test('review evidence turns Google review topics and recent reviews into labelled, quoted study signals', async () => {
  const data = { topics: [{ keyword: 'peaceful place', mentions: 4 }, { keyword: 'exam study', mentions: 3 }, { keyword: 'magazines', mentions: 7 }],
    reviews: [{ snippet: 'Very quiet reading hall, but the wifi is slow and it gets crowded before exams.', link: 'https://maps.example/r1' },
      { snippet: 'Good collection of books.', link: 'https://maps.example/r2' }] };
  const evidence = reviewEvidence(data);
  const by = Object.fromEntries(evidence.signals.map(s => [s.key, s]));
  assert.equal(by.quiet.mentions, 5);
  assert.equal(by.study.mentions, 4);
  assert.equal(by.wifi.mentions, 1);
  assert.equal(by.noisy.mentions, 1);
  assert.equal(by.quiet.link, 'https://maps.example/r1');
  assert.ok(by.quiet.quote.includes('quiet reading hall'));
  assert.equal(evidence.reviewed, 2);
  assert.equal(by.power, undefined);
  // Places without a Maps data ID are never looked up, and a failed lookup leaves the option unchanged
  const options = [{ name: 'A', placeId: null, dataId: null }, { name: 'B', placeId: 'p', dataId: 'd' }];
  await attachReviews(options, 'key', async () => ({ ok: false }));
  assert.deepEqual(options.map(o => o.evidence), [undefined, undefined]);
});
test('opening hours are read as Google Maps writes them, and a place closed for the session is dropped', async t => {
  const nb = String.fromCharCode(0x202f), dash = String.fromCharCode(0x2013);
  assert.deepEqual(openSpans(`10${nb}am${dash}8${nb}pm`), [[600, 1200]]);
  assert.deepEqual(openSpans(`9:30${nb}am${dash}1${nb}pm, 4${dash}8${nb}pm`), [[570, 780], [960, 1200]]);
  assert.deepEqual(openSpans(`11${dash}2${nb}pm`), [[660, 840]]);
  assert.deepEqual(openSpans(`6${nb}pm${dash}2${nb}am`), [[1080, 1560]]);
  assert.deepEqual(openSpans('Closed'), []);
  assert.deepEqual(openSpans('Open 24 hours'), [[0, 1440]]);
  assert.equal(openSpans('Hours might differ'), null);
  const week = { sunday: `9${nb}am${dash}6${nb}pm`, monday: 'Closed' };
  // 2026-10-11 is a Sunday: 5 PM for 90 minutes runs past a 6 PM close
  assert.deepEqual(openFor(week, '2026-10-11', 15 * 60, 90), { open: true, day: 'Sunday', hours: `9 am${dash}6 pm` });
  assert.equal(openFor(week, '2026-10-11', 17 * 60, 90).open, false);
  assert.equal(openFor(week, '2026-10-12', 15 * 60, 90).open, false);
  assert.equal(openFor(week, '2026-10-13', 15 * 60, 90), null);
  const previous = globalThis.fetch;
  t.after(() => { globalThis.fetch = previous; });
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ local_results: [
    { title: 'Late library', address: 'Indiranagar', operating_hours: { sunday: `9${nb}am${dash}9${nb}pm` } },
    { title: 'Early library', address: 'Jayanagar', operating_hours: { sunday: `9${nb}am${dash}5${nb}pm` } },
    { title: 'Unlisted hours', address: 'Malleshwaram' }] }) });
  const results = await discoverLive('Mysuru', [{ ...preferences, interests: ['library'] }], 'fixture-key', '2026-10-11');
  assert.deepEqual(results.map(r => r.name), ['Late library', 'Unlisted hours']);
  assert.equal(results[0].open.day, 'Sunday');
  assert.ok(!results[0].uncertainties[0].includes('hours') && results[1].uncertainties[0].includes('date-specific hours'));
});
test('trip times come from one directions search per starting area and place, and only the group totals leave', async () => {
  const minutes = { 'Jayanagar|A': [20, 45], 'Jayanagar|B': [30, 70], 'Malleshwaram|A': [15, 50], 'Malleshwaram|B': [10, 25] };
  const asked = [];
  const fetcher = async url => {
    const params = new URL(url).searchParams;
    const from = params.get('start_addr').split(',')[0], to = params.get('end_addr').split(',')[0];
    asked.push(`${params.get('engine')} ${from} -> ${to} ${params.get('time')}`);
    const [bike, bus] = minutes[`${from}|${to}`];
    return { ok: true, json: async () => ({ durations: [{ travel_mode: 'Two-wheeler', duration: bike * 60 }, { travel_mode: 'Transit', duration: bus * 60 }] }) };
  };
  const person = { ...preferences, budget: 300 };
  const group = [{ ...person, from: 'Jayanagar', travelMode: 'transit', maxTravel: 60 }, { ...person, from: 'jayanagar ', travelMode: 'two-wheeler' },
    { ...person, from: 'Malleshwaram', travelMode: 'transit', maxTravel: 30 }, person];
  const places = [{ name: 'B', subtitle: 'B road', dataId: 'b' }, { name: 'A', subtitle: 'A road', dataId: 'a' }, { name: 'Sample', sample: true }];
  const ordered = await attachTravel(places, group, 'Bengaluru', 'key', fetcher, '2026-10-11');
  // Two starting areas (the same area typed twice is one) times two real places: four searches, none for the sample
  assert.equal(asked.length, 4);
  // Each trip is timed for leaving 45 minutes before the session (5 PM IST on 11 October), not for now
  const leave = Date.parse('2026-10-11T16:15:00+05:30') / 1000;
  assert.ok(asked.every(a => a.startsWith('google_maps_directions ') && a.endsWith(` depart_at:${leave}`)));
  assert.deepEqual(places.find(p => p.name === 'A').travel, { longest: 50, over: 1, known: 3, of: 4 });
  assert.deepEqual(places.find(p => p.name === 'B').travel, { longest: 70, over: 1, known: 3, of: 4 });
  // Both real places put one person over their limit, so the shorter longest trip comes first; a place nobody
  // could time ranks ahead of a confirmed problem
  assert.deepEqual(ordered.map(p => p.name), ['Sample', 'A', 'B']);
  // Nobody's starting area, mode or own trip time is attached to an option
  assert.ok(!JSON.stringify(places).match(/Jayanagar|Malleshwaram|transit|two-wheeler/i));
  // A repeat search is served from memory
  await attachTravel(places, group, 'Bengaluru', 'key', fetcher, '2026-10-11');
  assert.equal(asked.length, 4);
});
