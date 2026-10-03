import * as Sentry from '@sentry/node';

// No HTTP auto-instrumentation: search URLs contain keys and request bodies
// contain private preferences. Export only spans we explicitly create.
const allowed = new Set(['gen_ai.system', 'gen_ai.request.model', 'sidequest.result_count', 'sidequest.status']);
export function redactEvent(event) {
  const cleanSpan = span => ({
    span_id: span.span_id, trace_id: span.trace_id, parent_span_id: span.parent_span_id,
    start_timestamp: span.start_timestamp, timestamp: span.timestamp,
    op: span.op, description: span.op, status: span.status,
    data: Object.fromEntries(Object.entries(span.data || {}).filter(([key]) => allowed.has(key))),
  });
  return {
    event_id: event.event_id, type: event.type, timestamp: event.timestamp,
    platform: 'node', transaction: 'sidequest.pipeline',
    contexts: event.contexts?.trace ? { trace: cleanSpan(event.contexts.trace) } : undefined,
    spans: event.spans?.map(cleanSpan),
    message: event.type === 'transaction' ? undefined : 'SideQuest pipeline failed',
  };
}
export function initTelemetry() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({ dsn: process.env.SENTRY_DSN, defaultIntegrations: false,
    sendDefaultPii: false, tracesSampleRate: 1,
    beforeSend: redactEvent, beforeSendTransaction: redactEvent });
}
export function trace(name, provider, work) {
  return Sentry.startSpan({ name, op: name, attributes: { 'gen_ai.system': provider } }, async span => {
    try { const value = await work(); span?.setAttribute('sidequest.status', 'ok'); return value; }
    catch (error) { span?.setAttribute('sidequest.status', 'failed'); span?.setStatus({ code: 2 });
      Sentry.captureMessage('SideQuest pipeline failed'); throw error; }
  });
}
