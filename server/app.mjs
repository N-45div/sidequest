import express from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import multer from 'multer';
import { runDiscovery, runInterpretation } from './workflows.mjs';
import { transcribeAudio, speakInvitation } from './voice.mjs';
import { enqueueDiscovery } from './durable.mjs';
import { preferenceSchema, sampleCandidates, toCalendar } from './planner.mjs';

const token = () => randomBytes(24).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
const nameSchema = z.string().trim().min(1).max(40);
const createSchema = z.object({ title: z.string().trim().min(1).max(80), city: z.string().trim().min(1).max(80), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v), name: nameSchema, mode: z.enum(['sample', 'live']) });
const fail = (status, message) => Object.assign(new Error(message), { status });

function publicState(group, member) {
  return {
    id: group.id, title: group.title, city: group.city, date: group.date, mode: group.mode, version: group.version,
    participants: group.members.map(m => ({ id: m.id, name: m.name, ready: !!m.preferences, voted: !!m.vote })),
    candidates: group.candidates.map(c => ({ ...c, votes: group.members.filter(m => m.vote === c.id).length })),
    decision: group.decision, observations: group.observations || [], discovery: group.discovery || null,
    me: { id: member.id, name: member.name, host: member.host, preferences: member.preferences, vote: member.vote },
  };
}

export function createApp(store, options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));
  app.use((req, res, next) => { res.set({ 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }); next(); });
  const rates = new Map();
  app.use('/api', (req, res, next) => {
    const now = Date.now(), key = req.ip;
    if (rates.size > 10000) for (const [k, value] of rates) if (now - value.start > 60000) rates.delete(k);
    let entry = rates.get(key);
    if (!entry || now - entry.start > 60000) { entry = { start: now, count: 0 }; rates.set(key, entry); }
    if (++entry.count > 180) return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
    next();
  });
  const load = async req => {
    const group = await store.get(req.params.id);
    if (!group) throw fail(404, 'This outing could not be found.');
    const auth = req.get('Authorization');
    const member = auth?.startsWith('Bearer ') ? group.members.find(m => m.tokenHash === digest(auth.slice(7))) : null;
    if (!member) throw fail(401, 'Join this outing or use the device where you joined.');
    return { group, member };
  };
  const save = async group => { if (!await store.save(group, group.revision)) throw fail(409, 'The group changed. Refresh and try again.'); };
  const unlocked = group => { if (group.decision) throw fail(409, 'This outing is already confirmed. Start a new outing to change the plan.'); };
  const reset = group => { group.version++; group.candidates = []; group.discovery = null; for (const m of group.members) m.vote = null; };
  const memberRecord = (name, host = false) => { const credential = token(); return { credential, member: { id: token().slice(0, 16), name, host, tokenHash: digest(credential), preferences: null, vote: null } }; };

  app.get('/api/health', (req, res) => res.json({ ok: true, storage: store.kind }));
  app.get('/api/capabilities', (req, res) => res.json({ ai: !!(process.env.GEMMA_BASE_URL && process.env.GEMMA_MODEL), liveSearch: !store.ephemeral && !!process.env.SERPAPI_API_KEY, voiceInput: !!process.env.ELEVENLABS_API_KEY, voiceOutput: !!(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID), temporaryPreview: !!store.ephemeral }));
  app.post('/api/outings', async (req, res) => {
    const input = createSchema.parse(req.body);
    if (store.ephemeral && input.mode === 'live') throw fail(503, 'Live outings need persistent storage. This preview supports sample activities only.');
    if (input.mode === 'live' && !process.env.SERPAPI_API_KEY) throw fail(503, 'Live venue search is not connected yet. Try the sample experience.');
    const { credential, member } = memberRecord(input.name, true);
    const group = { id: token().slice(0, 24), revision: 0, title: input.title, city: input.city, date: input.date, mode: input.mode, version: 0, members: [member], candidates: [], decision: null };
    await store.insert(group);
    res.status(201).json({ credential, outing: publicState(group, member) });
  });
  app.post('/api/demo', async (req, res) => {
    const { credential, member } = memberRecord('You', true);
    const defaults = { budget: 600, start: 1020, end: 1320, interests: ['coffee', 'games'], quiet: false, stepFree: false };
    member.preferences = defaults;
    const group = { id: token().slice(0, 24), revision: 0, title: 'The overdue catch-up', city: 'Bengaluru', date: new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }), mode: 'sample', version: 1, members: [member], candidates: [], decision: null };
    for (const [name, patch] of [['Riya', { budget: 500, interests: ['coffee', 'art'] }], ['Kabir', { interests: ['games', 'coffee'] }], ['Ananya', { budget: 450, interests: ['art', 'coffee'], quiet: true }]]) {
      const other = memberRecord(name).member;
      other.preferences = { ...defaults, ...patch }; group.members.push(other);
    }
    group.candidates = sampleCandidates(group.members.map(m => m.preferences));
    await store.insert(group);
    res.status(201).json({ credential, outing: publicState(group, member) });
  });
  app.get('/api/outings/:id/preview', async (req, res) => {
    const group = await store.get(req.params.id); if (!group) throw fail(404, 'This outing could not be found.');
    res.json({ title: group.title, city: group.city, date: group.date, mode: group.mode, closed: !!group.decision });
  });
  app.post('/api/outings/:id/join', async (req, res) => {
    const input = z.object({ name: nameSchema }).parse(req.body);
    const group = await store.get(req.params.id); if (!group) throw fail(404, 'This outing could not be found.');
    unlocked(group); if (group.members.length >= 8) throw fail(409, 'This outing has reached its eight-person limit.');
    const { credential, member } = memberRecord(input.name); group.members.push(member); reset(group); await save(group);
    res.status(201).json({ credential, outing: publicState(group, member) });
  });
  app.get('/api/outings/:id', async (req, res) => { const { group, member } = await load(req); res.json(publicState(group, member)); });
  app.put('/api/outings/:id/preferences', async (req, res) => {
    const { group, member } = await load(req); unlocked(group);
    member.preferences = preferenceSchema.parse(req.body); reset(group); await save(group); res.json(publicState(group, member));
  });
  app.post('/api/outings/:id/interpret', async (req, res) => {
    const { group } = await load(req); unlocked(group);
    const input = z.object({ text: z.string().trim().min(1).max(2000), defaults: preferenceSchema, consent: z.literal(true) }).parse(req.body);
    try { res.json({ draft: await runInterpretation(input) }); }
    catch { throw fail(503, 'AI interpretation is unavailable or returned an invalid draft. Use the controls to enter your preferences.'); }
  });
  app.post('/api/outings/:id/discover', async (req, res) => {
    const { group, member } = await load(req); unlocked(group);
    if (!member.host) throw fail(403, 'Only the organiser can find options.');
    if (group.members.some(m => !m.preferences)) throw fail(409, 'Wait until everyone has saved their preferences.');
    if (!store.ephemeral && (process.env.TEMPORAL_ADDRESS || options.enqueueDiscovery)) {
      if (group.discovery?.status === 'queued') {
        try { await (options.enqueueDiscovery || enqueueDiscovery)({ outingId: group.id, jobId: group.discovery.id, version: group.version }); }
        catch { throw fail(503, 'The background service is unavailable. Retry shortly.'); }
        return res.status(202).json(publicState(group, member));
      }
      reset(group);
      group.discovery = { id: token().slice(0, 24), status: 'queued', startedAt: new Date().toISOString() };
      await save(group);
      try { await (options.enqueueDiscovery || enqueueDiscovery)({ outingId: group.id, jobId: group.discovery.id, version: group.version }); }
      catch {
        const latest = await store.get(group.id);
        if (latest.discovery?.id === group.discovery.id) { latest.discovery.status = 'failed'; await store.save(latest, latest.revision); }
        throw fail(503, 'The background job could not start. Your preferences are saved; try again.');
      }
      return res.status(202).json(publicState(group, member));
    }
    const preferences = group.members.map(m => m.preferences);
    let candidates;
    try { candidates = await runDiscovery({ city: group.city, mode: group.mode, preferences }); }
    catch { throw fail(503, 'Venue search is unavailable. Your group is saved; try again shortly.'); }
    // Saving with the original revision prevents stale async results overwriting changed preferences.
    reset(group); group.candidates = candidates; await save(group); res.json(publicState(group, member));
  });
  app.post('/api/outings/:id/vote', async (req, res) => {
    const { group, member } = await load(req); unlocked(group);
    const input = z.object({ candidateId: z.string(), version: z.number().int() }).parse(req.body);
    if (input.version !== group.version || !group.candidates.some(c => c.id === input.candidateId)) throw fail(409, 'These options have changed. Refresh before voting.');
    if (!member.preferences) throw fail(409, 'Save your preferences before voting.');
    member.vote = input.candidateId; await save(group); res.json(publicState(group, member));
  });
  // Authenticate before reading a multipart body, bound memory, require explicit
  // consent, and return only an unsaved draft to the requesting member.
  const audioUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
    fileFilter: (req, file, done) => done(null, ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/mp4', 'audio/ogg'].includes(file.mimetype)) }).single('audio');
  app.post('/api/outings/:id/transcribe', async (req, res, next) => {
    const { group } = await load(req); unlocked(group);
    if (!process.env.ELEVENLABS_API_KEY) throw fail(503, 'Voice input is not connected yet.');
    audioUpload(req, res, error => {
      if (error) return next(fail(400, 'Choose one audio file smaller than 5 MB.'));
      if (!req.file || req.body.consent !== 'true') return next(fail(400, 'Choose an audio file and agree to send it for transcription.'));
      transcribeAudio(req.file).then(text => res.json({ text }), () => next(fail(503, 'Transcription is unavailable. Type your preferences instead.')));
    });
  });
  app.post('/api/outings/:id/speak', async (req, res) => {
    const { group } = await load(req);
    z.object({ consent: z.literal(true) }).parse(req.body);
    const candidate = group.candidates.find(c => c.id === group.decision?.candidateId);
    if (!candidate) throw fail(409, 'Confirm the outing before creating an audio invitation.');
    try { res.type('audio/mpeg').send(await speakInvitation(group, candidate)); }
    catch { throw fail(503, 'Audio invitations are unavailable. Use the calendar invite instead.'); }
  });
  app.post('/api/outings/:id/confirm', async (req, res) => {
    const { group, member } = await load(req);
    if (!member.host) throw fail(403, 'Only the organiser can confirm the outing.');
    const input = z.object({ candidateId: z.string(), version: z.number().int(), acknowledge: z.literal(true) }).parse(req.body);
    if (group.decision) { if (group.decision.candidateId !== input.candidateId) throw fail(409, 'A different option is already confirmed.'); return res.json(publicState(group, member)); }
    if (input.version !== group.version || !group.candidates.some(c => c.id === input.candidateId)) throw fail(409, 'These options have changed. Refresh before confirming.');
    if (!group.members.some(m => m.vote === input.candidateId)) throw fail(409, 'This option needs at least one vote before confirmation.');
    group.decision = { candidateId: input.candidateId, confirmedAt: new Date().toISOString() }; await save(group); res.json(publicState(group, member));
  });
  app.get('/api/outings/:id/calendar', async (req, res) => {
    const { group } = await load(req); const candidate = group.candidates.find(c => c.id === group.decision?.candidateId);
    if (!candidate) throw fail(409, 'Confirm an option before downloading the invite.');
    res.type('text/calendar').set('Content-Disposition', 'attachment; filename="sidequest.ics"').send(toCalendar(group, candidate));
  });
  app.delete('/api/outings/:id/me', async (req, res) => {
    const { group, member } = await load(req); unlocked(group); if (member.host) throw fail(409, 'The organiser cannot leave an active outing.');
    group.members = group.members.filter(m => m.id !== member.id); reset(group); await save(group); res.json({ ok: true });
  });
  app.post('/api/outings/:id/observations', async (req, res) => {
    const { group, member } = await load(req);
    if (!member.host) throw fail(403, 'Only the organiser can attach a device observation.');
    const input = z.object({ venue: z.string().trim().min(1).max(120), board: z.literal('UNO R3'), peakToPeak: z.number().int().min(0).max(1023) }).parse(req.body);
    group.observations = [...(group.observations || []), { ...input, observedAt: new Date().toISOString(), unit: 'raw ADC', calibrated: false }].slice(-5);
    await save(group); res.status(201).json({ ok: true });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use(express.static(resolve('dist'), { index: false }));
  app.get('/{*path}', (req, res) => res.sendFile(resolve('dist/index.html')));
  app.use((err, req, res, next) => {
    const status = err instanceof z.ZodError || err instanceof SyntaxError ? 400 : err.status || 500;
    res.status(status).json({ error: status === 400 ? 'Check the form values and try again.' : status === 500 ? 'Something went wrong. Please try again.' : err.message });
  });
  return app;
}
