import test from 'node:test';
import assert from 'node:assert/strict';
import { preferenceSchema, sampleCandidates, discoverLive } from '../server/planner.mjs';

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
