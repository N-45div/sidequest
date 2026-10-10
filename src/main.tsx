import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Zap, Plus, Users, LockKeyhole, Check, CalendarDays, MapPin, Coffee, Trees, BookOpen, GraduationCap, Laptop, X, Link, CheckCircle2, Clock3, Sparkles, LoaderCircle, ExternalLink, Download, SlidersHorizontal } from 'lucide-react';
import './style.css';

type TravelMode = 'transit' | 'two-wheeler' | 'driving' | 'walking';
type Preferences = { budget: number; start: number; end: number; interests: string[]; quiet: boolean; stepFree: boolean; from?: string; travelMode?: TravelMode; maxTravel?: number };
type Candidate = { id: string; name: string; subtitle: string; category: string; cost: number | null; duration: number; start: number; tone: string; sample: boolean; source: string | null; uncertainties: string[]; reason: string; votes: number; crowd?: { score: number; label: string; source: 'google' | 'tabpfn'; hour: number }; evidence?: { signals: { key: string; label: string; mentions: number; quote?: string; link?: string }[]; reviewed: number }; travel?: { longest: number; over: number; known: number; of: number }; open?: { open: boolean; day: string; hours: string } };
type Outing = { id: string; title: string; city: string; date: string; mode: 'sample' | 'live'; version: number; discovery: { status: 'queued' | 'complete' | 'failed' } | null; participants: { id: string; name: string; ready: boolean; voted: boolean }[]; candidates: Candidate[]; observations: { venue: string; board: string; peakToPeak: number; observedAt: string }[]; decision: { candidateId: string } | null; me: { id: string; name: string; host: boolean; preferences: Preferences | null; vote: string | null } };
type Preview = { title: string; city: string; date: string; mode: string; closed: boolean };
const icons: Record<string, typeof Coffee> = { coffee: Coffee, library: BookOpen, campus: GraduationCap, coworking: Laptop, outdoors: Trees, art: BookOpen, food: Coffee, games: Laptop };
const interestLabels: Record<string, string> = { library: 'Library', campus: 'Campus study space', coffee: 'Study cafe', coworking: 'Coworking space', outdoors: 'Outdoor study spot' };
const travelLabels: Record<TravelMode, string> = { transit: 'Bus or metro', 'two-wheeler': 'Two-wheeler', driving: 'Car or cab', walking: 'Walking' };
const defaults: Preferences = { budget: 150, start: 1020, end: 1320, interests: ['library', 'campus'], quiet: true, stepFree: false, from: '', travelMode: 'transit', maxTravel: 45 };
const formatTime = (minutes: number) => new Date(2000, 0, 1, 0, minutes).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const timeValue = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const parseTime = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const tomorrow = () => { const d = new Date(Date.now() + 86400000); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); };

function App() {
  const [outing, setOuting] = useState<Outing | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [route, setRoute] = useState(() => location.pathname.match(/^\/q\/([a-f0-9]+)$/)?.[1] || '');
  const [capabilities, setCapabilities] = useState({ ai: false, liveSearch: false, voiceInput: false, voiceOutput: false, temporaryPreview: false });
  const [loading, setLoading] = useState(!!route);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [draft, setDraft] = useState<Preferences>(defaults);
  const [text, setText] = useState('');
  const [consent, setConsent] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioConsent, setAudioConsent] = useState(false);
  const [speechConsent, setSpeechConsent] = useState(false);
  const [speechUrl, setSpeechUrl] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tokenFor = (id: string) => sessionStorage.getItem(`sidequest:${id}`) || '';

  async function api(path: string, method = 'GET', body?: unknown, id = route) {
    const credential = tokenFor(id);
    const response = await fetch(`/api${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(credential ? { Authorization: `Bearer ${credential}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed. Please try again.');
    return data;
  }
  async function action(key: string, work: () => Promise<void>) {
    setBusy(key); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(''); }
  }
  function enter(data: { credential: string; outing: Outing }) {
    sessionStorage.setItem(`sidequest:${data.outing.id}`, data.credential);
    history.pushState({}, '', `/q/${data.outing.id}`); setRoute(data.outing.id); setOuting(data.outing); setPreview(null);
  }
  function home() { history.pushState({}, '', '/'); setRoute(''); setOuting(null); setPreview(null); setError(''); }
  useEffect(() => { api('/capabilities').then(setCapabilities).catch(() => {}); const pop = () => { setOuting(null); setRoute(location.pathname.match(/^\/q\/([a-f0-9]+)$/)?.[1] || ''); }; window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop); }, []);
  useEffect(() => {
    if (!route) { setLoading(false); return; }
    let cancelled = false;
    const refresh = async (initial = false) => {
      try {
        if (tokenFor(route)) { const data = await api(`/outings/${route}`); if (!cancelled) { setOuting(data); setPreview(null); } }
        else { const data = await api(`/outings/${route}/preview`); if (!cancelled) setPreview(data); }
      } catch (e) { if (!cancelled && initial) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    refresh(true); const timer = setInterval(refresh, 5000); return () => { cancelled = true; clearInterval(timer); };
  }, [route]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (preferencesOpen) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [preferencesOpen]);
  useEffect(() => { setSpeechUrl(''); setSpeechConsent(false); }, [route]);
  useEffect(() => () => { if (speechUrl) URL.revokeObjectURL(speechUrl); }, [speechUrl]);

  function editPreferences() { setDraft(outing?.me.preferences || defaults); setText(''); setConsent(false); setAudioFile(null); setAudioConsent(false); setPreferencesOpen(true); }
  async function transcribe() {
    if (!audioFile || !audioConsent) return;
    if (audioFile.size > 5 * 1024 * 1024) throw new Error('Choose an audio file smaller than 5 MB.');
    const form = new FormData(); form.append('audio', audioFile); form.append('consent', 'true');
    const response = await fetch(`/api/outings/${route}/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${tokenFor(route)}` }, body: form });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    setText(data.text); setAudioFile(null); setNotice('Review your transcript. Your saved preferences have not changed.');
  }
  async function createSpeech() {
    const response = await fetch(`/api/outings/${route}/speak`, { method: 'POST', headers: { Authorization: `Bearer ${tokenFor(route)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true }) });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
    setSpeechUrl(URL.createObjectURL(await response.blob()));
  }
  async function copyInvite() { await navigator.clipboard.writeText(`${location.origin}/q/${route}`); setNotice('Invite link copied. Classmates join with their own private preferences.'); }
  async function downloadCalendar() {
    const response = await fetch(`/api/outings/${route}/calendar`, { headers: { Authorization: `Bearer ${tokenFor(route)}` } });
    if (!response.ok) throw new Error('Could not download the invite.');
    const url = URL.createObjectURL(await response.blob()); const a = document.createElement('a'); a.href = url; a.download = 'sidequest.ics'; a.click(); URL.revokeObjectURL(url);
  }
  const confirmed = outing?.candidates.find(c => c.id === outing.decision?.candidateId);
  const ready = outing?.participants.filter(p => p.ready).length || 0;

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="wordmark" onClick={home} aria-label="SideQuest home"><span className="brand-icon"><Zap size={22} fill="currentColor" /></span>sidequest<span className="brand-period">.</span></button>
      <div className="sidebar-topline">STUDY BETTER TOGETHER</div>
      <button className={`nav-item ${!outing ? 'active' : ''}`} onClick={home}><Plus size={19} /> New study circle</button>
      {outing && <div className="nav-item active"><Users size={19} /> Your study circle</div>}
      <div className="sidebar-note"><div className="note-number">01</div><p>Less “what’s the plan?”<br /><strong>More learning together.</strong></p><span>Make time for the next study session.</span></div>
      <div className="sidebar-bottom"><LockKeyhole size={18} /><p>Your preferences are private.<br /><span>The decision is shared.</span></p></div>
    </aside>

    <main>
      <header className="topbar"><div className="mobile-brand"><Zap size={18} /> sidequest.</div><span className="breadcrumb">Your circle. One study plan.</span><span className="edition">CAMPUS EDITION <span>✦</span></span></header>
      {error && <div className="message error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={18} /></button></div>}
      {notice && <div className="message success" role="status">{notice}</div>}
      {capabilities.temporaryPreview && <div className="sample-banner" role="status"><Sparkles size={17} /><span><strong>Temporary preview.</strong> Sample study spaces only. Groups and invite links clear when this service restarts. Avoid using this preview for plans you need to keep.</span></div>}

      {loading && !outing ? <div className="loading"><LoaderCircle className="spin" /> Opening your study circle…</div> : outing ? <>
        <section className="room-heading">
          <div><div className="eyebrow"><span className="tiny-star">✦</span> {confirmed ? 'IT’S HAPPENING' : 'YOUR STUDY CIRCLE'}</div><h1>{outing.title}<span className="lime-period">.</span></h1><div className="meta"><span><MapPin size={16} /> {outing.city}</span><span><CalendarDays size={16} /> {dateLabel(outing.date)}</span><span><Users size={16} /> {outing.participants.length} people</span></div></div>
          <button className="button secondary" onClick={() => action('copy', copyInvite)} disabled={!!busy || !!outing.decision}><Link size={17} /> Invite classmates</button>
        </section>
        {outing.mode === 'sample' && <div className="sample-banner"><Sparkles size={17} /><span><strong>Sample experience.</strong> Study spaces and costs are illustrative. The demo students are fictional.</span></div>}
        {outing.discovery?.status === 'queued' && <div className="sample-banner" role="status"><LoaderCircle className="spin" size={17} /><span>Finding options in the background. You can leave this page and return. Use Find our options to retry connecting if needed.</span></div>}
        {outing.discovery?.status === 'failed' && <div className="message error" role="alert">The background search could not finish. Your preferences are saved. Try finding options again.</div>}
        <section className="people-strip"><div><div className="avatar-stack">{outing.participants.map((p, i) => <span key={p.id} className={`avatar avatar-${i % 4}`} title={`${p.name}${p.ready ? ' · ready' : ' · waiting'}`}>{p.name.charAt(0)}{p.ready && <i><Check size={9} /></i>}</span>)}</div><div><strong>{ready} of {outing.participants.length} ready</strong><p>{outing.participants.map(p => p.name).join(', ')}</p></div></div><button className="text-button" onClick={editPreferences} disabled={!!outing.decision}><SlidersHorizontal size={16} /> {outing.me.preferences ? 'Your preferences' : 'Add your preferences'}</button></section>

        {confirmed ? <section className="confirmed"><span className="confirmed-icon"><CheckCircle2 size={40} /></span><div className="eyebrow">STUDY CIRCLE, MEET CONFIRMED SESSION</div><h2>{confirmed.name}</h2><p>{dateLabel(outing.date)} · {formatTime(confirmed.start)} IST · {outing.city}</p><div className="confirmation-note">{confirmed.uncertainties.join(' ')}</div><button className="button primary" onClick={() => action('calendar', downloadCalendar)} disabled={!!busy}><Download size={18} /> Save to calendar</button>{capabilities.voiceOutput && <div className="voice-controls"><label className="check-label"><input type="checkbox" checked={speechConsent} onChange={e => setSpeechConsent(e.target.checked)} /> Send the confirmed plan to ElevenLabs to create an audio invitation.</label><button className="button secondary" disabled={!!busy || !speechConsent} onClick={() => action('speech', createSpeech)}>Create audio invite</button>{speechUrl && <audio controls src={speechUrl} />}</div>}</section> : <>
          <section className="section-heading"><div><div className="eyebrow">THE SHORTLIST</div><h2>{outing.candidates.length ? 'A place to study together.' : 'Let’s find your common ground.'}</h2><p>{outing.candidates.length ? 'Pick your favourite. The organiser confirms the final choice.' : 'Everyone saves their preferences, then the organiser finds options.'}</p></div>{outing.me.host && <button className="button primary" disabled={!!busy || ready !== outing.participants.length} onClick={() => action('discover', async () => { const data = await api(`/outings/${route}/discover`, 'POST', {}); setOuting(data); if (data.discovery?.status === 'queued') setNotice('Finding options in the background. This room will update automatically.'); else if (!data.candidates.length) setNotice('No options fit. Update your preferences together and try again.'); })}>{busy === 'discover' ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />} {outing.candidates.length ? 'Find fresh options' : 'Find our options'}</button>}</section>
          {outing.candidates.length ? <div className="candidate-grid">{outing.candidates.map((candidate, i) => {
            const Icon = icons[candidate.category] || Coffee, selected = outing.me.vote === candidate.id;
            return <article className={`candidate-card ${selected ? 'selected' : ''}`} key={candidate.id}>
              <div className={`card-visual ${candidate.tone}`}><span className="option-number">OPTION 0{i + 1}</span><Icon size={64} strokeWidth={1.3} /><span className="category-label">{interestLabels[candidate.category]}</span><span className="visual-caption">{candidate.sample ? 'STUDY SPACE CONCEPT' : 'SEARCH RESULT'}</span></div>
              <div className="card-content"><h3>{candidate.name}</h3><p className="card-subtitle">{candidate.subtitle}</p><div className="card-facts"><span>{candidate.cost == null ? 'Price unverified' : candidate.cost === 0 ? 'Free study space' : `₹${candidate.cost} / person`}</span><span><Clock3 size={14} /> {candidate.duration} min</span></div><p className="reason"><Check size={14} /> {candidate.reason}</p>{candidate.crowd && <p className="crowd"><Users size={14} /> <span>{candidate.crowd.label} around {candidate.crowd.hour % 12 || 12} {candidate.crowd.hour < 12 ? 'AM' : 'PM'}<small>{candidate.crowd.source === 'google' ? 'Google popular times' : 'TabPFN forecast from similar places'}</small></span></p>}{candidate.travel && <p className={`crowd ${candidate.travel.over ? 'warn' : ''}`}><MapPin size={14} /> <span>Longest trip for anyone: {candidate.travel.longest} min<small>{candidate.travel.over ? `Longer than ${candidate.travel.over} ${candidate.travel.over === 1 ? 'person' : 'people'} would like` : 'Within everyone’s travel limit'}{candidate.travel.known < candidate.travel.of ? ` · ${candidate.travel.known} of ${candidate.travel.of} shared where they start` : ''} · Google Maps directions</small></span></p>}{candidate.open && <p className="crowd"><Clock3 size={14} /> <span>Open {candidate.open.hours} on {candidate.open.day}s<small>Google Maps opening hours</small></span></p>}{candidate.evidence && <div className="evidence"><span className="evidence-head">What reviewers mention</span><div className="evidence-chips">{candidate.evidence.signals.slice(0, 4).map(s => <span key={s.key} className={`evidence-chip ${s.key === 'noisy' ? 'warn' : ''}`}>{s.label} · {s.mentions}</span>)}</div>{candidate.evidence.signals.find(s => s.quote) && <a className="evidence-quote" href={candidate.evidence.signals.find(s => s.quote)!.link} target="_blank" rel="noreferrer">“{candidate.evidence.signals.find(s => s.quote)!.quote}”</a>}<small>Google review topics{candidate.evidence.reviewed ? ` and ${candidate.evidence.reviewed} recent reviews` : ''} · not verified</small></div>}<p className="uncertainty">{candidate.uncertainties[0]}</p>{candidate.source && <a className="source-link" href={candidate.source} target="_blank" rel="noreferrer">Check venue details <ExternalLink size={13} /></a>}<div className="vote-row"><button className={`button ${selected ? 'voted' : 'vote-button'}`} disabled={!!busy || !outing.me.preferences} onClick={() => action('vote', async () => setOuting(await api(`/outings/${route}/vote`, 'POST', { candidateId: candidate.id, version: outing.version })))}>{selected ? <Check size={16} /> : <Plus size={16} />}{selected ? 'Your pick' : 'Count me in'}</button><span>{candidate.votes} {candidate.votes === 1 ? 'vote' : 'votes'}</span></div></div>
            </article>;
          })}</div> : <div className="empty-state"><span><Users size={32} /></span><h3>{ready === outing.participants.length ? 'Your circle is ready.' : 'A good plan includes everyone.'}</h3><p>{ready === outing.participants.length ? 'Find options using the group’s saved preferences.' : 'Share the link and give everyone a moment to add theirs.'}</p>{!outing.me.preferences && <button className="button secondary" onClick={editPreferences}>Add my preferences</button>}</div>}
          {!!outing.candidates.length && outing.me.host && <div className="finalise"><div><h3>Found the one?</h3><label className="check-label"><input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} /> I’ll check the venue details and unresolved requirements before visiting.</label></div><button className="button primary" disabled={!!busy || !outing.me.vote || !acknowledge} onClick={() => action('confirm', async () => setOuting(await api(`/outings/${route}/confirm`, 'POST', { candidateId: outing.me.vote, version: outing.version, acknowledge: true })))}><CheckCircle2 size={18} /> Confirm my pick</button></div>}
        </>}
        {!!outing.observations?.length && <section className="sample-banner"><span><strong>Recent device observation</strong><br />{outing.observations.at(-1)!.venue}: {outing.observations.at(-1)!.peakToPeak} raw ADC · UNO R3 · {new Date(outing.observations.at(-1)!.observedAt).toLocaleTimeString()}<br />Uncalibrated, time-specific signal. Not decibels or a guarantee of quiet.</span></section>}
        <div className="privacy-footnote"><LockKeyhole size={14} /> Only you can see your exact preferences. Everyone can see the options and votes.</div>
      </> : preview ? <section className="join-panel"><div className="eyebrow">YOU’RE INVITED</div><h1>{preview.title}<span className="lime-period">.</span></h1><p className="meta">{preview.city} · {dateLabel(preview.date)}</p><p>Bring your preferences. Let’s find something that works for everyone.</p>{preview.mode === 'sample' && <div className="sample-banner">This is a sample study circle with illustrative spaces.</div>}{preview.closed ? <p>This study session is already confirmed and closed to new participants.</p> : <form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); action('join', async () => enter(await api(`/outings/${route}/join`, 'POST', { name: form.get('name') }))); }}><label>Your name<input name="name" required maxLength={40} autoComplete="given-name" placeholder="What should your classmates call you?" /></label><button className="button primary" disabled={!!busy}><Users size={18} /> Join the study circle</button></form>}</section> : <section className="home-grid">
        <div className="home-copy"><div className="eyebrow"><span className="tiny-star">✦</span> MAKE THE STUDY CIRCLE HAPPEN</div><h1>“We should<br />study together.”<br /><span className="muted-headline">Let’s actually<br />do it.</span></h1><p className="intro">Your classmates. Their preferences.<br />One plan you can all say yes to.</p><div className="home-steps"><span><i>01</i> Gather your circle</span><span><i>02</i> Find common ground</span><span><i>03</i> Make it happen</span></div><div className="home-privacy"><LockKeyhole size={17} /><p>Private budgets. Shared decisions.<br /><span>No one has to explain their limits.</span></p></div></div>
        <div className="create-panel"><div className="panel-top"><span className="panel-icon"><Zap size={22} /></span><span>YOUR NEXT SIDEQUEST</span><span className="small-star">✦</span></div><h2>Start your study circle.</h2><p>We’ll help you figure out the rest.</p><form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); action('create', async () => enter(await api('/outings', 'POST', { title: form.get('title'), city: form.get('city'), date: form.get('date'), name: form.get('name'), mode: form.get('mode') }))); }}>
          <label>Give the study session a name<input name="title" placeholder="Data structures revision" required maxLength={80} /></label>
          <div className="form-row"><label>Your name<input name="name" placeholder="Your name" required maxLength={40} autoComplete="given-name" /></label><label>City<input name="city" placeholder="e.g. Bengaluru" required maxLength={80} /></label></div>
          <label>When are we studying?<input type="date" name="date" required defaultValue={tomorrow()} /></label>
          <label>Find options using<select name="mode" defaultValue="sample"><option value="sample">Sample study spaces · no accounts needed</option><option value="live" disabled={!capabilities.liveSearch}>Live study spaces {capabilities.liveSearch ? '' : '· not connected yet'}</option></select></label>
          <button className="button primary full" disabled={!!busy}>{busy === 'create' ? <LoaderCircle className="spin" size={18} /> : <Plus size={18} />} Create a study circle</button>
        </form><div className="demo-divider"><span>or take a little look around</span></div><button className="button demo full" disabled={!!busy} onClick={() => action('demo', async () => enter(await api('/demo', 'POST', {})))}><Sparkles size={17} /> Explore a sample circle</button><p className="demo-disclosure">Fictional students. Illustrative costs. A working study circle.</p></div>
      </section>}
      <footer><span>MAKE ROOM FOR LEARNING TOGETHER.</span><span>Built for student study circles, school or college.</span></footer>
    </main>

    <dialog ref={dialogRef} onCancel={() => setPreferencesOpen(false)} onClose={() => setPreferencesOpen(false)} className="preferences-dialog"><form onSubmit={e => { e.preventDefault(); action('preferences', async () => { setOuting(await api(`/outings/${route}/preferences`, 'PUT', draft)); setPreferencesOpen(false); setNotice('Your private preferences are saved. Previous options and votes are cleared.'); }); }}>
      <div className="dialog-heading"><div><div className="eyebrow"><LockKeyhole size={13} /> JUST BETWEEN US</div><h2>What works for you?</h2></div><button type="button" className="icon-button" onClick={() => setPreferencesOpen(false)} aria-label="Close preferences"><X /></button></div><p className="dialog-intro">Your group sees the options, not your exact budget or requirements.</p>
      {capabilities.voiceInput && <div className="voice-controls"><label>Upload a short voice note (up to 5 MB)<input type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/webm,audio/mp4,audio/ogg" onChange={e => setAudioFile(e.target.files?.[0] || null)} /></label><label className="check-label"><input type="checkbox" checked={audioConsent} onChange={e => setAudioConsent(e.target.checked)} /> Send this recording to ElevenLabs for transcription.</label><button type="button" className="button secondary" disabled={!!busy || !audioFile || !audioConsent} onClick={() => action('transcribe', transcribe)}>Transcribe, then review</button>{!capabilities.ai && <label>Transcript<textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} /><small>Use the controls below to enter these preferences.</small></label>}</div>}
      {capabilities.ai && <div className="ai-input"><label>Tell us in your own words<textarea value={text} onChange={e => setText(e.target.value)} maxLength={2000} placeholder="kal 4 ke baad free, ₹200 max, library ya cafe, somewhere quiet…" /></label><label className="check-label"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Send this text to SideQuest’s open model (Qwen3.5-4B, fine-tuned for this, hosted on Tinker). It drafts; you review.</label><button type="button" className="button secondary" disabled={!!busy || !consent || !text.trim()} onClick={() => action('interpret', async () => { const data = await api(`/outings/${route}/interpret`, 'POST', { text, defaults: draft, consent: true }); setDraft({ ...draft, ...data.draft }); setNotice('Review the draft below before saving.'); })}><Sparkles size={16} /> Interpret, then review</button></div>}
      <label>Maximum study-space spend per person <span className="private-label">PRIVATE</span><div className="budget-value">₹<input type="number" aria-label="Maximum study-space spend per person" min={0} max={100000} required value={draft.budget} onChange={e => setDraft({ ...draft, budget: Number(e.target.value) })} /></div></label>
      <div className="form-row"><label>Free from<input type="time" value={timeValue(draft.start)} required onChange={e => setDraft({ ...draft, start: parseTime(e.target.value) })} /></label><label>Until<input type="time" value={timeValue(draft.end === 1440 ? 1439 : draft.end)} required onChange={e => setDraft({ ...draft, end: parseTime(e.target.value) })} /></label></div>
      <label>Starting from <span className="private-label">PRIVATE</span><input value={draft.from || ''} maxLength={80} placeholder="Your area, e.g. Jayanagar" autoComplete="off" onChange={e => setDraft({ ...draft, from: e.target.value })} /><small className="field-note">Used only to time each trip. The group sees the longest trip, never who it is.</small></label>
      <div className="form-row"><label>Getting there<select value={draft.travelMode || 'transit'} onChange={e => setDraft({ ...draft, travelMode: e.target.value as TravelMode })}>{Object.entries(travelLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Longest trip you’re OK with<select value={draft.maxTravel || 45} onChange={e => setDraft({ ...draft, maxTravel: Number(e.target.value) })}>{[15, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} min</option>)}</select></label></div>
      <fieldset><legend>Where can you study?</legend><div className="interest-grid">{Object.entries(interestLabels).map(([key, label]) => { const Icon = icons[key]; return <label key={key} className={`interest ${draft.interests.includes(key) ? 'chosen' : ''}`}><input type="checkbox" checked={draft.interests.includes(key)} onChange={e => setDraft({ ...draft, interests: e.target.checked ? [...draft.interests, key] : draft.interests.filter(i => i !== key) })} /><Icon size={18} /> {label}</label>; })}</div></fieldset>
      <label className="check-label requirement"><input type="checkbox" checked={draft.quiet} onChange={e => setDraft({ ...draft, quiet: e.target.checked })} /> I need somewhere quiet</label><label className="check-label requirement"><input type="checkbox" checked={draft.stepFree} onChange={e => setDraft({ ...draft, stepFree: e.target.checked })} /> I need step-free access</label>
      <p className="dialog-warning">Saving changes clears the group’s previous options and votes.</p>{error && <p className="inline-error" role="alert">{error}</p>}<button className="button primary full" disabled={!!busy || !draft.interests.length || draft.end <= draft.start}><Check size={18} /> Save my preferences</button>
    </form></dialog>
  </div>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
