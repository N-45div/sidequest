import { Connection, Client, WorkflowExecutionAlreadyStartedError } from '@temporalio/client';
import { runDiscovery } from './workflows.mjs';
export const taskQueue = 'sidequest-discovery';
export function temporalOptions() {
  return { address: process.env.TEMPORAL_ADDRESS, ...(process.env.TEMPORAL_API_KEY ? { tls: true, apiKey: process.env.TEMPORAL_API_KEY } : {}) };
}
let client;
export async function enqueueDiscovery(input) {
  if (!client) client = Connection.connect(temporalOptions()).then(connection => new Client({ connection, namespace: process.env.TEMPORAL_NAMESPACE || 'default' }));
  try { await (await client).workflow.start('discover', { taskQueue, workflowId: `discovery-${input.jobId}`, args: [input] }); }
  catch (error) { if (error instanceof WorkflowExecutionAlreadyStartedError) return; client = undefined; throw error; }
}
export function createFailureActivity(store) {
  return async ({ outingId, jobId }) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const group = await store.get(outingId);
      if (!group || group.discovery?.id !== jobId || group.discovery.status !== 'queued') return;
      group.discovery.status = 'failed';
      if (await store.save(group, group.revision)) return;
    }
    throw new Error('Job failure save conflicted.');
  };
}
export function createDiscoveryActivity(store, planner = runDiscovery) {
  return async ({ outingId, jobId, version }) => {
    let group = await store.get(outingId);
    const current = g => g && !g.decision && g.version === version && g.discovery?.id === jobId;
    if (!current(group)) return { status: 'superseded' };
    if (group.discovery.status === 'complete') return { status: 'complete', count: group.candidates.length };
    const candidates = await planner({ city: group.city, mode: group.mode, preferences: group.members.map(m => m.preferences) });
    // Reload after the tool completes. Unrelated observations must not lose data;
    // changed preferences or a new job must never receive these old results.
    for (let attempt = 0; attempt < 5; attempt++) {
      group = await store.get(outingId);
      if (!current(group)) return { status: 'superseded' };
      if (group.discovery.status === 'complete') return { status: 'complete', count: group.candidates.length };
      group.candidates = candidates;
      group.discovery = { ...group.discovery, status: 'complete' };
      if (await store.save(group, group.revision)) return { status: 'complete', count: candidates.length };
    }
    throw new Error('Discovery save conflicted.');
  };
}
