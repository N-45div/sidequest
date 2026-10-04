import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
const base = process.argv[2];
if (!base || new URL(base).protocol !== 'https:') throw new Error('Supply the public HTTPS SideQuest URL.');
const sessionPath = 'artifacts/live-check-session.json';
const reportPath = 'evaluations/render-live.json';
const json = async (path, method = 'GET', body, credential) => {
  const response = await fetch(`${base}/api${path}`, { method, signal: AbortSignal.timeout(30000),
    headers: { ...(body ? { 'Content-Type':'application/json' } : {}), ...(credential ? { Authorization:`Bearer ${credential}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status:response.status, data:await response.json() };
};
const health = await json('/health'); assert.equal(health.status, 200); assert.equal(health.data.storage, 'MongoDB Atlas');
const capabilities = await json('/capabilities'); assert.equal(capabilities.data.temporaryPreview, false);
if (process.argv.includes('--verify-persistence')) {
  const session = JSON.parse(await readFile(sessionPath, 'utf8'));
  if (session.base !== base) throw new Error('Stored check belongs to a different service.');
  const state = await json(`/outings/${session.id}`, 'GET', undefined, session.credential);
  assert.equal(state.status, 200); assert.deepEqual(state.data.decision, session.decision);
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  report.persistenceVerifiedAt = new Date().toISOString();
  report.persistence = 'The confirmed outing was read back after a completed Render redeployment.';
  await writeFile(reportPath, JSON.stringify(report, null, 2)+'\n');
  console.log('Post-redeployment persistence passed against the public Atlas-backed app.');
} else {
  const date = new Date(Date.now()+86400000).toLocaleDateString('en-CA', { timeZone:'Asia/Kolkata' });
  const host = await json('/outings', 'POST', { title:'SideQuest launch check', city:'Bengaluru', date, name:'Test organiser', mode:'sample' });
  assert.equal(host.status, 201); const id=host.data.outing.id, credential=host.data.credential;
  const guest = await json(`/outings/${id}/join`, 'POST', { name:'Test guest' }); assert.equal(guest.status,201);
  const preferences = { budget:317, start:1020, end:1320, interests:['coffee','art'], quiet:true, stepFree:true };
  assert.equal((await json(`/outings/${id}/preferences`, 'PUT', preferences, credential)).status, 200);
  const guestView = await json(`/outings/${id}/preferences`, 'PUT', { ...preferences, budget:829 }, guest.data.credential);
  assert.equal(guestView.status,200); assert.equal(guestView.data.me.preferences.budget,829);
  assert.equal(guestView.data.me.id, guest.data.outing.me.id);
  assert.ok(!('members' in guestView.data));
  assert.ok(guestView.data.participants.every(person => !('preferences' in person) && !('tokenHash' in person)));
  assert.equal((await json(`/outings/${id}`)).status,401);
  assert.equal((await json(`/outings/${id}/discover`, 'POST', {}, guest.data.credential)).status,403);
  const choices=await json(`/outings/${id}/discover`, 'POST', {}, credential); assert.equal(choices.status,200);
  assert.ok(choices.data.candidates.length>0);
  assert.ok(choices.data.candidates.every(candidate => candidate.cost<=317 && candidate.quiet && candidate.stepFree));
  const vote={ candidateId:choices.data.candidates[0].id, version:choices.data.version };
  assert.equal((await json(`/outings/${id}/vote`, 'POST', vote, guest.data.credential)).status,200);
  assert.equal((await json(`/outings/${id}/confirm`, 'POST', { ...vote, acknowledge:true }, guest.data.credential)).status,403);
  const confirmed=await json(`/outings/${id}/confirm`, 'POST', { ...vote, acknowledge:true }, credential); assert.equal(confirmed.status,200);
  const repeated=await json(`/outings/${id}/confirm`, 'POST', { ...vote, acknowledge:true }, credential);
  assert.deepEqual(repeated.data.decision,confirmed.data.decision);
  const calendar=await fetch(`${base}/api/outings/${id}/calendar`, { headers:{ Authorization:`Bearer ${credential}` } });
  assert.equal(calendar.status,200); assert.ok((await calendar.text()).includes('BEGIN:VEVENT'));
  await mkdir('artifacts', { recursive:true });
  await writeFile(sessionPath,JSON.stringify({ base,id,credential,decision:confirmed.data.decision }));
  await writeFile(reportPath,JSON.stringify({ recordedAt:new Date().toISOString(),url:base,storage:health.data.storage,
    commit:process.env.DEPLOYED_COMMIT || null, provenance:'Actual public Render API execution using fictional test participants',
    checks:['health','persistent storage mode','create','independent guest join','private preference isolation','outsider rejection',
      'host-only discovery','known hard filters','voting','host-only confirmation','idempotent confirmation','calendar download'],
    persistence:'Pending an additional completed redeployment and read-back.' },null,2)+'\n');
  console.log('Public Render API checks passed. Session credential saved only in ignored artifacts for the restart check.');
}
