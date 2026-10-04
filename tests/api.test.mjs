import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
import { sampleCandidates, toCalendar } from '../server/planner.mjs';

async function fixture(t, options) {
  const store = await createStore({ mongoUri: null, file: ':memory:' });
  const server = createApp(store, options).listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(async () => { await new Promise(r => server.close(r)); await store.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  return async (path, method = 'GET', body, token) => {
    const response = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.status, data: response.headers.get('content-type')?.includes('application/json') ? await response.json() : await response.text() };
  };
}
const preferences = { budget: 600, start: 1020, end: 1320, interests: ['coffee', 'art'], quiet: true, stepFree: true };
test('queued discovery dispatches only IDs, retries the same job, and changes invalidate it', async t => {
  const jobs = [];
  const call = await fixture(t, { enqueueDiscovery: async input => { jobs.push(input); } });
  const { data: host } = await call('/demo', 'POST', {}); const id = host.outing.id;
  const first = await call(`/outings/${id}/discover`, 'POST', {}, host.credential);
  assert.equal(first.status, 202); assert.equal(first.data.discovery.status, 'queued');
  assert.equal(first.data.candidates.length, 0);
  assert.deepEqual(Object.keys(jobs[0]).sort(), ['jobId', 'outingId', 'version']);
  await call(`/outings/${id}/discover`, 'POST', {}, host.credential);
  assert.deepEqual(jobs[0], jobs[1]);
  const changed = await call(`/outings/${id}/preferences`, 'PUT', preferences, host.credential);
  assert.equal(changed.data.discovery, null);
});
test('dispatch failures leave a visible retryable job and preserve preferences', async t => {
  const call = await fixture(t, { enqueueDiscovery: async () => { throw new Error('Injected outage'); } });
  const { data: host } = await call('/demo', 'POST', {}); const id = host.outing.id;
  assert.equal((await call(`/outings/${id}/discover`, 'POST', {}, host.credential)).status, 503);
  const state = (await call(`/outings/${id}`, 'GET', undefined, host.credential)).data;
  assert.equal(state.discovery.status, 'failed'); assert.equal(state.me.preferences.budget, 600);
});
test('audio routes require membership, consent and a confirmed plan', async t => {
  const call = await fixture(t);
  const { data: host } = await call('/demo', 'POST', {}); const id = host.outing.id;
  assert.equal((await call(`/outings/${id}/transcribe`, 'POST', {})).status, 401);
  assert.equal((await call(`/outings/${id}/speak`, 'POST', { consent: true })).status, 401);
  assert.equal((await call(`/outings/${id}/speak`, 'POST', {}, host.credential)).status, 400);
  assert.equal((await call(`/outings/${id}/speak`, 'POST', { consent: true }, host.credential)).status, 409);
});
test('participants cannot access others’ exact constraints, and outsider tokens cannot access an outing', async t => {
  const call = await fixture(t);
  const { data: host } = await call('/outings', 'POST', { title: 'Catch-up', city: 'Bengaluru', date: '2026-10-04', name: 'Host', mode: 'sample' });
  const id = host.outing.id;
  const { data: friend } = await call(`/outings/${id}/join`, 'POST', { name: 'Friend' });
  await call(`/outings/${id}/preferences`, 'PUT', { ...preferences, budget: 317 }, host.credential);
  await call(`/outings/${id}/preferences`, 'PUT', { ...preferences, budget: 829 }, friend.credential);
  const { data: view } = await call(`/outings/${id}`, 'GET', undefined, friend.credential);
  assert.equal(view.me.preferences.budget, 829);
  assert.ok(view.participants.every(p => !('preferences' in p) && !('tokenHash' in p)));
  assert.equal(view.me.id, friend.outing.me.id);
  assert.ok(!('members' in view));
  assert.equal((await call(`/outings/${id}`)).status, 401);
  const { data: outsider } = await call('/demo', 'POST', {});
  assert.equal((await call(`/outings/${id}`, 'GET', undefined, outsider.credential)).status, 401);
  const preview = (await call(`/outings/${id}/preview`)).data;
  assert.deepEqual(Object.keys(preview).sort(), ['city', 'closed', 'date', 'mode', 'title']);
});
test('changed preferences invalidate candidates and votes; only host can discover or confirm', async t => {
  const call = await fixture(t);
  const { data: host } = await call('/demo', 'POST', {}); const id = host.outing.id;
  const { data: friend } = await call(`/outings/${id}/join`, 'POST', { name: 'Guest' });
  await call(`/outings/${id}/preferences`, 'PUT', preferences, friend.credential);
  assert.equal((await call(`/outings/${id}/discover`, 'POST', {}, friend.credential)).status, 403);
  const { data: state } = await call(`/outings/${id}/discover`, 'POST', {}, host.credential);
  const vote = { candidateId: state.candidates[0].id, version: state.version };
  assert.equal((await call(`/outings/${id}/vote`, 'POST', vote, friend.credential)).status, 200);
  assert.equal((await call(`/outings/${id}/confirm`, 'POST', { ...vote, acknowledge: true }, friend.credential)).status, 403);
  const { data: changed } = await call(`/outings/${id}/preferences`, 'PUT', { ...preferences, budget: 300 }, friend.credential);
  assert.equal(changed.candidates.length, 0);
  assert.equal(changed.me.vote, null);
  assert.equal((await call(`/outings/${id}/vote`, 'POST', vote, host.credential)).status, 409);
  assert.equal((await call(`/outings/${id}/confirm`, 'POST', { ...vote, acknowledge: true }, host.credential)).status, 409);
});
test('confirmation is idempotent and calendar uses correct IST conversion', async t => {
  const call = await fixture(t);
  const { data: host } = await call('/demo', 'POST', {}); const id = host.outing.id;
  const vote = { candidateId: host.outing.candidates[0].id, version: host.outing.version };
  assert.equal((await call(`/outings/${id}/confirm`, 'POST', { ...vote, acknowledge: true }, host.credential)).status, 409);
  await call(`/outings/${id}/vote`, 'POST', vote, host.credential);
  const first = await call(`/outings/${id}/confirm`, 'POST', { ...vote, acknowledge: true }, host.credential);
  const repeated = await call(`/outings/${id}/confirm`, 'POST', { ...vote, acknowledge: true }, host.credential);
  assert.deepEqual(first.data.decision, repeated.data.decision);
  assert.equal((await call(`/outings/${id}/preferences`, 'PUT', preferences, host.credential)).status, 409);
  assert.equal((await call(`/outings/${id}/join`, 'POST', { name: 'Late friend' })).status, 409);
  const calendar = await call(`/outings/${id}/calendar`, 'GET', undefined, host.credential);
  assert.equal(calendar.status, 200); assert.ok(calendar.data.includes('BEGIN:VEVENT'));
  assert.ok(toCalendar({ id: 'test', title: 'Plan\nnew line', city: 'City', date: '2026-10-04' }, { name: 'Coffee', start: 1020, duration: 90, uncertainties: [] }).includes('DTSTART:20261004T113000Z'));
});
test('known budget, availability, quiet and step-free requirements are hard filters', () => {
  const result = sampleCandidates([{ ...preferences, budget: 250 }]);
  assert.ok(result.length > 0); assert.ok(result.every(c => c.cost <= 250 && c.quiet && c.stepFree));
  assert.equal(sampleCandidates([{ ...preferences, start: 1020, end: 1040 }]).length, 0);
  assert.ok(sampleCandidates([{ ...preferences, budget: 0 }]).every(c => c.cost === 0));
});
test('optimistic revisions prevent concurrent writes overwriting saved preferences', async t => {
  const store = await createStore({ mongoUri: null, file: ':memory:' }); t.after(() => store.close());
  await store.insert({ id: 'one', revision: 0, value: 1 });
  const first = await store.get('one'), second = await store.get('one');
  assert.equal(await store.save({ ...first, value: 2 }, first.revision), true);
  assert.equal(await store.save({ ...second, value: 3 }, second.revision), false);
  assert.equal((await store.get('one')).value, 2);
});
test('invalid preference ranges and impossible calendar dates are rejected', async t => {
  const call = await fixture(t);
  assert.equal((await call('/outings', 'POST', { title: 'Test', city: 'City', date: '2026-02-31', name: 'Name', mode: 'sample' })).status, 400);
  const { data: host } = await call('/demo', 'POST', {});
  assert.equal((await call(`/outings/${host.outing.id}/preferences`, 'PUT', { ...preferences, end: 500 }, host.credential)).status, 400);
});
