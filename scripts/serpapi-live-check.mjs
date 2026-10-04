import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const base = process.argv[2];
assert.equal(new URL(base).protocol, 'https:');
const request = async (path, method = 'GET', body, credential) => {
  const response = await fetch(`${base}/api${path}`, { signal: AbortSignal.timeout(40000), method,
    headers: { ...(body ? { 'Content-Type':'application/json' } : {}), ...(credential ? { Authorization:`Bearer ${credential}` } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  assert.ok(response.ok, `API check failed: ${response.status}`);
  return response.json();
};
assert.equal((await request('/capabilities')).liveSearch, true);
const date = new Date(Date.now()+86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
const host = await request('/outings','POST',{title:'College study-space verification',city:'Bengaluru',date,name:'Test organiser',mode:'live'});
const path = `/outings/${host.outing.id}`;
await request(`${path}/preferences`,'PUT',{budget:500,start:1020,end:1320,interests:['library'],quiet:true,stepFree:true},host.credential);
const result = await request(`${path}/discover`,'POST',{},host.credential);
assert.ok(result.candidates.length > 0);
for (const candidate of result.candidates) {
  assert.equal(candidate.sample,false);
  assert.equal(new URL(candidate.source).hostname,'www.google.com');
  assert.equal(candidate.cost,null); assert.equal(candidate.quiet,null); assert.equal(candidate.stepFree,null);
  assert.ok(candidate.retrievedAt && candidate.uncertainties.length);
}
await writeFile('evaluations/serpapi-live.json',JSON.stringify({recordedAt:new Date().toISOString(),url:base,
  purpose:'College study-circle venue discovery',engine:'google_maps',workflow:'Mastra sidequest-discovery',city:'Bengaluru',
  provenance:'Actual public Render execution with fictional test organiser; venue results came from SerpApi',
  checks:['live capability enabled','live outing created','private preferences saved','actual search produced source-linked venues','unknown cost/noise/access remain unknown'],
  candidates:result.candidates.map(({name,source,retrievedAt,uncertainties})=>({name,source,retrievedAt,uncertainties}))},null,2)+'\n');
console.log('Public SerpApi discovery passed; credential omitted from report.');
