import { Worker, NativeConnection } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { createDiscoveryActivity, createFailureActivity, taskQueue, temporalOptions } from './durable.mjs';
import { initTelemetry } from './telemetry.mjs';
if (!process.env.TEMPORAL_ADDRESS) throw new Error('Set TEMPORAL_ADDRESS before starting the worker.');
initTelemetry();
const store = await createStore();
const connection = await NativeConnection.connect(temporalOptions());
try {
  const worker = await Worker.create({ connection, namespace: process.env.TEMPORAL_NAMESPACE || 'default', taskQueue,
    workflowsPath: fileURLToPath(new URL('./temporal-workflows.cjs', import.meta.url)), activities: { discoverOuting: createDiscoveryActivity(store), failDiscovery: createFailureActivity(store) } });
  await worker.run();
} finally { await connection.close(); await store.close(); }
