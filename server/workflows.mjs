import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { preferenceSchema, sampleCandidates, discoverLive, extractPreferences } from './planner.mjs';
import { trace } from './telemetry.mjs';

const inputSchema = z.object({ city: z.string().min(1).max(80), mode: z.enum(['sample', 'live']), date: z.string().optional(),
  preferences: z.array(preferenceSchema).min(1).max(8) });
const candidatesSchema = z.array(z.object({ id: z.string(), name: z.string(), duration: z.number(), start: z.number() }).passthrough());
const search = createStep({ id: 'discover-venues', inputSchema, outputSchema: candidatesSchema,
  execute: async ({ inputData }) => trace('gen_ai.execute_tool', inputData.mode === 'sample' ? 'sample' : 'serpapi', () =>
    inputData.mode === 'sample' ? sampleCandidates(inputData.preferences) : discoverLive(inputData.city, inputData.preferences, process.env.SERPAPI_API_KEY, inputData.date)) });
const validate = createStep({ id: 'validate-shortlist', inputSchema: candidatesSchema, outputSchema: candidatesSchema,
  execute: async ({ inputData }) => inputData.slice(0, 3) });
// No Mastra storage or exporter is registered. Private inputs stay in this
// process; external telemetry uses the explicit redacted Sentry spans only.
const discovery = createWorkflow({ id: 'sidequest-discovery', inputSchema, outputSchema: candidatesSchema })
  .then(search).then(validate).commit();
const extractionInput = z.object({ text: z.string().min(1).max(2000), defaults: preferenceSchema });
const extract = createStep({ id: 'extract-preferences', inputSchema: extractionInput, outputSchema: preferenceSchema,
  execute: async ({ inputData }) => trace('gen_ai.chat', 'qwen-tinker', () => extractPreferences(inputData.text, inputData.defaults)) });
const interpretation = createWorkflow({ id: 'sidequest-interpretation', inputSchema: extractionInput, outputSchema: preferenceSchema }).then(extract).commit();
async function run(workflow, inputData) {
  const execution = await workflow.createRun();
  const result = await execution.start({ inputData });
  if (result.status !== 'success') throw new Error('Planning workflow could not complete.');
  return result.result;
}
export const runDiscovery = input => trace('gen_ai.invoke_agent', 'mastra', () => run(discovery, input));
export const runInterpretation = input => trace('gen_ai.invoke_agent', 'mastra', () => run(interpretation, input));
