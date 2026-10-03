import { createStore } from './store.mjs';
import { createApp } from './app.mjs';
import { initTelemetry } from './telemetry.mjs';
initTelemetry();
const store = await createStore();
const server = createApp(store).listen(Number(process.env.PORT || 3100), '0.0.0.0', () => console.log(`SideQuest API ready; storage: ${store.kind}`));
async function shutdown() { server.close(async () => { await store.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
