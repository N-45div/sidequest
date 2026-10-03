import { TestWorkflowEnvironment } from '@temporalio/testing';
import { Worker, Runtime, DefaultLogger } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { createDiscoveryActivity, createFailureActivity } from '../server/durable.mjs';
Runtime.install({ logger: new DefaultLogger('ERROR') });
const env = await TestWorkflowEnvironment.createLocal();
const store = await createStore({ mongoUri: null, file: ':memory:' });
let worker;
try {
  const preferences = { budget: 600, start: 1020, end: 1320, interests: ['coffee'], quiet: true, stepFree: true };
  await store.insert({ id: 'recovery-fixture', revision: 0, city: 'Bengaluru', mode: 'sample', version: 1,
    members: [{ preferences }], candidates: [], discovery: { id: 'recovery-job', status: 'queued' } });
  const input = { outingId: 'recovery-fixture', jobId: 'recovery-job', version: 1 };
  const activity = createDiscoveryActivity(store);
  let reportFirstAttempt;
  const firstAttempt = new Promise(resolve => { reportFirstAttempt = resolve; });
  let attempts = 0;
  const options = { connection: env.nativeConnection, taskQueue: 'recovery-check',
    workflowsPath: fileURLToPath(new URL('../server/temporal-workflows.cjs', import.meta.url)),
    activities: { discoverOuting: async value => {
      if (++attempts === 1) { reportFirstAttempt(); throw new Error('Injected transient tool failure.'); }
      return activity(value);
    }, failDiscovery: createFailureActivity(store) } };
  const handle = await env.client.workflow.start('discover', { workflowId: `recovery-${Date.now()}`, taskQueue: 'recovery-check', args: [input] });
  worker = await Worker.create(options);
  const firstRun = worker.run();
  await firstAttempt;
  worker.shutdown(); await firstRun;
  // A fresh worker processes the persisted retry without restarting the job.
  worker = await Worker.create(options);
  const secondRun = worker.run();
  const result = await handle.result();
  worker.shutdown(); await secondRun; worker = null;
  assert.equal(result.status, 'complete'); assert.equal(attempts, 2);
  assert.ok((await store.get(input.outingId)).candidates.length > 0);
  const history = await handle.fetchHistory();
  const encodedHistory = JSON.stringify(history);
  assert.ok(!encodedHistory.includes('"budget"'));
  await mkdir('evaluations', { recursive: true });
  await writeFile('evaluations/temporal-recovery.json', JSON.stringify({ recordedAt: new Date().toISOString(),
    environment: 'Local official Temporal test server, in-memory fixture store',
    injectedFailure: 'First discovery activity throws; first worker shuts down; new worker finishes retry',
    attempts, result, historyEvents: history.events.length, privatePreferencesSentAsWorkflowArguments: false }, null, 2) + '\n');
  console.log('Temporal recovery passed: a fresh worker completed the persisted activity retry.');
} finally { worker?.shutdown(); await store.close(); await env.teardown(); }
