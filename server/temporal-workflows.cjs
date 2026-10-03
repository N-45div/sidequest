const { proxyActivities } = require('@temporalio/workflow');
const { discoverOuting, failDiscovery } = proxyActivities({ startToCloseTimeout: '90 seconds', scheduleToCloseTimeout: '10 minutes',
  retry: { initialInterval: '2 seconds', maximumInterval: '30 seconds', maximumAttempts: 5 } });
// Workflow history contains opaque IDs only, never private preference payloads.
exports.discover = async function discover(input) {
  try { return await discoverOuting(input); }
  catch (error) { await failDiscovery({ outingId: input.outingId, jobId: input.jobId }); throw error; }
};
