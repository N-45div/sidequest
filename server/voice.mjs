import { trace } from './telemetry.mjs';

export async function transcribeAudio(file, fetcher = fetch) {
  if (!process.env.ELEVENLABS_API_KEY) throw new Error('Voice is not configured.');
  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), 'preference-audio');
  form.append('model_id', 'scribe_v1');
  // Diarization and audio event detection are unnecessary for a private draft.
  form.append('diarize', 'false');
  const result = await trace('gen_ai.execute_tool', 'elevenlabs', () => fetcher('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }, body: form, signal: AbortSignal.timeout(30000),
  }));
  if (!result.ok) throw new Error('Transcription unavailable.');
  const data = await result.json();
  if (typeof data.text !== 'string' || !data.text.trim() || data.text.length > 2000) throw new Error('Invalid transcript.');
  return data.text;
}
export async function speakInvitation(group, candidate, fetcher = fetch) {
  if (!process.env.ELEVENLABS_API_KEY || !process.env.ELEVENLABS_VOICE_ID) throw new Error('Voice is not configured.');
  const text = `${group.title}. ${candidate.name}, in ${group.city}, on ${group.date}, at ${Math.floor(candidate.start / 60)}:${String(candidate.start % 60).padStart(2, '0')} India time. Please check venue details before visiting.`;
  const response = await trace('gen_ai.execute_tool', 'elevenlabs', () => fetcher(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(process.env.ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_128`, {
    method: 'POST', signal: AbortSignal.timeout(30000), headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  }));
  if (!response.ok) throw new Error('Speech unavailable.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024 || !bytes.length) throw new Error('Invalid speech output.');
  return bytes;
}
