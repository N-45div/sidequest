// Scores off-the-shelf open-weight models on the same hand-written held-out messages and prompt as
// scripts/tinker_study.py, through one Backboard key. Memory and web search stay off.
import { readFile, writeFile } from 'node:fs/promises';
if (!process.env.BACKBOARD_API_KEY) throw new Error('Set BACKBOARD_API_KEY in .env.');
const models = process.env.BACKBOARD_MODELS ? JSON.parse(process.env.BACKBOARD_MODELS) : [
  'google/gemma-4-31b-it', 'google/gemma-3-4b-it', 'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-small-3.2-24b-instruct', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b',
].map(model => ({ provider: 'openrouter', model }));
const headers = { 'X-API-Key': process.env.BACKBOARD_API_KEY, 'Content-Type': 'application/json' };
const heldout = JSON.parse(await readFile(new URL('../evaluations/extraction-heldout.json', import.meta.url), 'utf8'));
const prompt = (await readFile(new URL('../server/extraction-prompt.txt', import.meta.url), 'utf8')).trim()
  .replace('{defaults}', JSON.stringify(heldout.defaults));
const catalogue = (await (await fetch('https://app.backboard.io/api/models?model_type=llm&provider=openrouter&limit=500', { headers })).json()).models;
const minutes = value => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(value)); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const keys = ['budget', 'start', 'end', 'spaces', 'quiet', 'stepFree'];

function fields(p, e) {
  return { budget: Number.isInteger(p.budget) && p.budget === e.budget,
    start: minutes(p.start) === minutes(e.start), end: minutes(p.end) === minutes(e.end),
    spaces: Array.isArray(p.spaces) && [...new Set(p.spaces.map(String))].sort().join() === [...e.spaces].sort().join(),
    quiet: p.quiet === e.quiet, stepFree: p.stepFree === e.stepFree };
}

async function score({ provider, model }, example) {
  const started = performance.now();
  const response = await fetch('https://app.backboard.io/api/threads/messages', {
    method: 'POST', signal: AbortSignal.timeout(90000), headers,
    body: JSON.stringify({ llm_provider: provider, model_name: model, memory: 'off', web_search: 'off', json_output: true,
      system_prompt: prompt, content: example.text }),
  });
  const latencyMs = Math.round(performance.now() - started);
  if (!response.ok) return { text: example.text, error: `HTTP ${response.status}`, exact: false, fields: {}, latencyMs };
  const data = await response.json();
  // Billing and routing failures can arrive as a 200 with a notice instead of a model reply.
  if (data.input_tokens == null || (data.status && data.status !== 'COMPLETED')) throw new Error(`Backboard did not run the model: ${String(data.content).slice(0, 160)}`);
  let prediction = null;
  try { prediction = JSON.parse(/\{[\s\S]*\}/.exec(data.content || '')?.[0]); } catch { /* invalid output counts as a miss */ }
  const matched = prediction && typeof prediction === 'object' ? fields(prediction, example.expected) : {};
  return { text: example.text, expected: example.expected, output: String(data.content || '').slice(0, 400),
    exact: keys.every(k => matched[k]), fields: matched, latencyMs,
    inputTokens: data.input_tokens ?? null, outputTokens: data.output_tokens ?? null };
}

const reports = [];
for (const entry of models) {
  const rows = [];
  for (let i = 0; i < heldout.cases.length; i += 5) rows.push(...await Promise.all(heldout.cases.slice(i, i + 5).map(c => score(entry, c))));
  const price = catalogue.find(m => m.name === entry.model) || {};
  const tokens = rows.filter(r => r.inputTokens != null);
  const cost = tokens.reduce((sum, r) => sum + r.inputTokens * (price.input_cost_per_1m_tokens ?? NaN) + r.outputTokens * (price.output_cost_per_1m_tokens ?? NaN), 0) / 1e6;
  const latencies = rows.map(r => r.latencyMs).sort((a, b) => a - b);
  const report = { ...entry, cases: rows.length, errors: rows.filter(r => r.error).length,
    exactAccuracy: rows.filter(r => r.exact).length / rows.length,
    fieldAccuracy: Object.fromEntries(keys.map(k => [k, rows.filter(r => r.fields[k]).length / rows.length])),
    medianLatencyMs: latencies[Math.floor(latencies.length / 2)],
    usdPer1000Extractions: tokens.length ? Number((cost / tokens.length * 1000).toFixed(4)) : null,
    pricePer1MTokens: { input: price.input_cost_per_1m_tokens ?? null, output: price.output_cost_per_1m_tokens ?? null }, rows };
  reports.push(report);
  console.log(JSON.stringify({ model: entry.model, exact: report.exactAccuracy, errors: report.errors, medianLatencyMs: report.medianLatencyMs, usdPer1000: report.usdPer1000Extractions }));
}
await writeFile(new URL('../evaluations/backboard-comparison.json', import.meta.url), JSON.stringify({
  recordedAt: new Date().toISOString(), provenance: 'Same 50 hand-written synthetic held-out messages and prompt as the Tinker study; no participant data',
  latencyNote: 'Wall time from this machine through Backboard and OpenRouter; not comparable to Tinker sampling latency', reports }, null, 1) + '\n');
