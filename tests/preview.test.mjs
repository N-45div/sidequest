import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { createApp } from '../server/app.mjs';
test('production refuses temporary storage unless an explicit preview is selected', async t => {
  const old = process.env.NODE_ENV, oldPreview = process.env.ALLOW_EPHEMERAL_DEMO;
  process.env.NODE_ENV = 'production'; delete process.env.ALLOW_EPHEMERAL_DEMO;
  t.after(() => { if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old;
    if (oldPreview === undefined) delete process.env.ALLOW_EPHEMERAL_DEMO; else process.env.ALLOW_EPHEMERAL_DEMO = oldPreview; });
  await assert.rejects(createStore({ mongoUri: null }), /MONGODB_URI is required/);
  process.env.ALLOW_EPHEMERAL_DEMO = 'true';
  const store = await createStore({ mongoUri: null });
  assert.equal(store.kind, 'temporary demo'); assert.equal(store.ephemeral, true);
  const server = createApp(store).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await store.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const capabilities = await (await fetch(base + '/capabilities')).json();
  assert.equal(capabilities.temporaryPreview, true); assert.equal(capabilities.liveSearch, false);
  const result = await fetch(base + '/outings', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Preview', city: 'City', date: '2026-10-05', name: 'Host', mode: 'live' }) });
  assert.equal(result.status, 503);
  const demo = await fetch(base + '/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(demo.status, 201);
});
