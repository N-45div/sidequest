import test from 'node:test';
import assert from 'node:assert/strict';
import { preferenceSchema, sampleCandidates, discoverLive, rankCandidates } from '../server/planner.mjs';
import { crowdAt } from '../server/busyness.mjs';
import { reviewEvidence, attachReviews } from '../server/reviews.mjs';

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
