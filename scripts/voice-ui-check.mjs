import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
// Provider responses are fixtures. This verifies browser consent and draft
// review, not successful ElevenLabs/Gemma cloud processing.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
let uploads = 0, interpretations = 0, invitations = 0;
await page.route('**/api/capabilities', route => route.fulfill({ json: { ai: true, liveSearch: false, voiceInput: true, voiceOutput: true } }));
await page.route('**/transcribe', route => { uploads++; assert.ok(route.request().postData().includes('true')); return route.fulfill({ json: { text: 'Coffee, under 350 rupees, after six.' } }); });
await page.route('**/interpret', route => { interpretations++; const body = route.request().postDataJSON(); assert.equal(body.consent, true); return route.fulfill({ json: { draft: { ...body.defaults, budget: 350 } } }); });
await page.route('**/speak', route => { invitations++; assert.equal(route.request().postDataJSON().consent, true); return route.fulfill({ contentType: 'audio/mpeg', body: Buffer.from('fixture-not-real-audio') }); });
try {
  await page.goto('http://127.0.0.1:3100');
  await page.getByRole('button', { name: 'Explore a sample group' }).click();
  await page.getByRole('button', { name: 'Your preferences', exact: true }).click();
  await page.getByLabel('Upload a short voice note (up to 5 MB)').setInputFiles({ name: 'note.wav', mimeType: 'audio/wav', buffer: Buffer.from('fixture') });
  assert.equal(await page.getByRole('button', { name: 'Transcribe, then review' }).isDisabled(), true);
  await page.getByLabel('Send this recording to ElevenLabs for transcription.').check();
  await page.getByRole('button', { name: 'Transcribe, then review' }).click();
  await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('Coffee, under'));
  assert.equal(await page.getByLabel('Maximum spend per person', { exact: true }).inputValue(), '600');
  assert.equal(await page.getByRole('button', { name: 'Interpret, then review' }).isDisabled(), true);
  await page.getByLabel('Send this text to the configured AI provider.').check();
  await page.getByRole('button', { name: 'Interpret, then review' }).click();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Maximum spend per person"]')?.value === '350');
  mkdirSync('artifacts', { recursive: true }); await page.screenshot({ path: 'artifacts/voice-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Save my preferences' }).click();
  await page.getByRole('button', { name: 'Find our options' }).click();
  await page.getByRole('button', { name: 'Count me in' }).first().click();
  await page.getByLabel('I’ll check the venue details and unresolved requirements before visiting.').check();
  await page.getByRole('button', { name: 'Confirm my pick' }).click();
  assert.equal(await page.getByRole('button', { name: 'Create audio invite' }).isDisabled(), true);
  await page.getByLabel('Send the confirmed plan to ElevenLabs to create an audio invitation.').check();
  await page.getByRole('button', { name: 'Create audio invite' }).click();
  await page.locator('audio').waitFor();
  assert.equal(uploads, 1); assert.equal(interpretations, 1); assert.equal(invitations, 1); assert.deepEqual(errors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  console.log('Voice UI passed: consent gates, unsaved transcript, draft review, confirmed invitation, mobile layout. Provider responses were fixtures.');
} finally { await browser.close(); }
