import test from 'node:test';
import assert from 'node:assert/strict';
import { runDiscovery } from '../server/workflows.mjs';
import { redactEvent } from '../server/telemetry.mjs';
import { createDiscoveryActivity, createFailureActivity } from '../server/durable.mjs';
import { createStore } from '../server/store.mjs';
import { transcribeAudio, speakInvitation } from '../server/voice.mjs';
import { vectorLiteral, hybridQuery } from '../server/venue-index.mjs';
const preferences = { budget: 317, start: 1020, end: 1320, interests: ['coffee'], quiet: true, stepFree: true };
test('venue embeddings reject nonfinite or wrong-dimension inputs; search binds city and freshness', () => {
  assert.throws(() => vectorLiteral([1, 2]));
  assert.throws(() => vectorLiteral(Array(384).fill(Infinity)));
  assert.equal(vectorLiteral(Array(384).fill(0)), `[${Array(384).fill(0).join(',')}]`);
  assert.ok(hybridQuery.includes('city = $1'));
  assert.ok(hybridQuery.includes("interval '30 days'"));
  assert.ok(hybridQuery.includes('UNION ALL'));
});
test('Mastra executes a shortlist using the real constraint planner', async () => {
  const options = await runDiscovery({ city: 'Bengaluru', mode: 'sample', preferences: [preferences] });
  assert.ok(options.length > 0); assert.ok(options.every(c => c.cost <= 317 && c.quiet && c.stepFree));
});
test('trace export removes prompts, credentials, request URLs, user and breadcrumbs', () => {
  const result = redactEvent({ type: 'transaction', user: { email: 'private@example.com' },
    request: { headers: { Authorization: 'SECRET' }, url: 'https://example.com?api_key=SECRET' },
    extra: { budget: 317 }, breadcrumbs: [{ message: 'private words' }],
    spans: [{ op: 'gen_ai.chat', description: 'private words', data: { 'gen_ai.system': 'gemma', prompt: 'private words', budget: 317 } }] });
  const encoded = JSON.stringify(result);
  for (const value of ['SECRET', 'private words', '317', 'example.com']) assert.ok(!encoded.includes(value));
  assert.equal(result.spans[0].data['gen_ai.system'], 'gemma');
});
test('durable activity discards results when preferences change during search', async t => {
  const store = await createStore({ mongoUri: null, file: ':memory:' }); t.after(() => store.close());
  await store.insert({ id: 'group', revision: 0, version: 1, city: 'City', mode: 'sample', members: [{ preferences }], discovery: { id: 'job', status: 'queued' }, candidates: [] });
  const activity = createDiscoveryActivity(store, async () => {
    const group = await store.get('group'); group.version++; group.discovery = null;
    await store.save(group, group.revision); return [{ id: 'stale' }];
  });
  assert.deepEqual(await activity({ outingId: 'group', jobId: 'job', version: 1 }), { status: 'superseded' });
  assert.deepEqual((await store.get('group')).candidates, []);
  await createFailureActivity(store)({ outingId: 'group', jobId: 'job' });
  assert.equal((await store.get('group')).discovery, null);
});
test('durable activity is idempotent and returns no private fields', async t => {
  const store = await createStore({ mongoUri: null, file: ':memory:' }); t.after(() => store.close());
  await store.insert({ id: 'group', revision: 0, version: 1, city: 'City', mode: 'sample', members: [{ preferences }], discovery: { id: 'job', status: 'queued' }, candidates: [] });
  let calls = 0;
  const activity = createDiscoveryActivity(store, async () => { calls++; return [{ id: 'option' }]; });
  const input = { outingId: 'group', jobId: 'job', version: 1 };
  assert.deepEqual(await activity(input), { status: 'complete', count: 1 });
  assert.deepEqual(await activity(input), { status: 'complete', count: 1 }); assert.equal(calls, 1);
});
test('voice adapters return an unsaved draft and send only the public confirmed invitation', async t => {
  const oldKey = process.env.ELEVENLABS_API_KEY, oldVoice = process.env.ELEVENLABS_VOICE_ID;
  process.env.ELEVENLABS_API_KEY = 'test-only'; process.env.ELEVENLABS_VOICE_ID = 'test-voice';
  t.after(() => { if (oldKey === undefined) delete process.env.ELEVENLABS_API_KEY; else process.env.ELEVENLABS_API_KEY = oldKey;
    if (oldVoice === undefined) delete process.env.ELEVENLABS_VOICE_ID; else process.env.ELEVENLABS_VOICE_ID = oldVoice; });
  assert.equal(await transcribeAudio({ buffer: Buffer.from('fixture'), mimetype: 'audio/wav' }, async (url, options) => {
    assert.equal(options.body.get('model_id'), 'scribe_v1'); return Response.json({ text: 'Coffee after six' });
  }), 'Coffee after six');
  const output = await speakInvitation({ title: 'Catch-up', city: 'City', date: '2026-10-04', members: [{ preferences }] }, { name: 'Coffee', start: 1080 }, async (url, options) => {
    assert.ok(!options.body.includes('317')); assert.ok(!options.body.includes('preferences')); return new Response('audio-fixture');
  });
  assert.equal(output.toString(), 'audio-fixture');
});
