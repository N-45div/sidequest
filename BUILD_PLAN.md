# SideQuest build plan

Status: core prototype, Mastra workflow, Temporal queue/worker, voice flows, redacted tracing and hybrid-retrieval adapters implemented. Local recovery and browser checks pass; cloud verification remains incomplete. See SPONSORS.md and NEXT_STEPS.md.
Date: October 3, 2026 (IST).
Hosting: Render, per user instruction. Build as a new independent repository; do not reuse Spatialize's application or history.
Deadline: October 5, 2026, 12:29 PM IST. Internal submission target: 10:30 AM IST.

## Product

For the real friend who always organises outings: turn everyone's private constraints into a shortlist they can agree on.

Signature moment: several conflicting preferences become three feasible options; friends vote and confirm one shared outing.

Independent scope: no conference session assignment, conference coverage, combined conference brief, or automatic schedule repair. No copied Parallel code, branding, UI, or assets.

User chose a hypothetical persona; sample group and city are clearly labelled. Real-recipient validation remains unresolved for the challenge prompt. User confirmed an Arduino UNO R3, not UNO Q: support R3 honestly, but do not claim UNO Q category eligibility.

## User journey

1. Host creates an outing: city, date, rough area, group size, decision deadline.
2. Friends join through an invitation link. Each gets their own private participant capability; the shared invite does not grant access to other people's constraints.
3. Each enters availability, spending ceiling, travel limit, hard requirements, and soft preferences, by text or optional voice.
4. AI proposes structured interpretations. The participant confirms them before they become constraints.
5. Search retrieves real candidate venues with URLs and retrieval timestamps. Unknown prices, hours, access details, and travel times remain explicit.
6. Deterministic checks reject candidates violating known hard constraints. AI explains only public-safe tradeoffs. If none fit, request consent to relax a constraint without identifying its owner.
7. Three candidate cards appear with estimated costs, sources, uncertainties, and reason for inclusion. No claim that unknown accessibility or dietary suitability is verified.
8. Friends vote; the host confirms a choice. Changed preferences invalidate stale candidates and votes rather than silently changing a confirmed outing.
9. Generate a shared invite and downloadable calendar entry. Share through the user's chosen app; no automatic messages or bookings.
10. After the outing, an optional private satisfaction response contributes to future recommendations.

## Visual direction

Midnight blue, electric lime, and crisp white. A lively decision room with friend avatars, large venue cards, restrained map context, and a clear voting reveal. Mobile is the primary surface. Desktop expands into candidate comparison. No oversized marketing hero before the product.

Screens: create outing, private preference entry, shared decision room, confirmed invite, private history/settings. Internal evaluation and sponsor evidence stay outside the normal product flow.

## All 16 sponsor roles

These are intended roles, not assertions that credentials, hardware, SDK compatibility, or category qualification are already available.

| Sponsor | Concrete work | Acceptance evidence |
| --- | --- | --- |
| Render | Host React assets and Node API; run durable-workflow worker as an appropriate background service | Public deployed URL, healthy service, completed real journey |
| Gemma | Interpret preferences and explain source-grounded candidate tradeoffs | Recorded real model calls, model identifier, extraction evaluation |
| DigitalOcean | Serve Gemma on separate inference infrastructure | Deployment record plus successful app-to-model request; compute cost recorded |
| Mastra | Orchestrate preference extraction, search, retrieval, validation, and explanations | Executed workflow/tool steps with failures handled |
| SerpApi | Discover real local venues and retrieve search evidence | Search request plus resulting source-linked candidates |
| MongoDB Atlas | Authoritative outing, membership, private constraint, vote, and decision records | Persistence and isolation verified across separate browser sessions |
| Tiger Data | Venue corpus with embeddings and hybrid retrieval | Explainable retrieval query finding relevant previously indexed venues |
| Temporal | Own durable jobs, retries, timeouts, and resumable discovery | Deliberately interrupted job resumes without duplicate candidates or finalisation |
| Sentry Agent Tracing | Trace model calls, tools, latency, errors, and available usage metrics | Redacted trace screenshots and an actual failure diagnosed |
| ElevenLabs | Transcribe participant voice input; read confirmed outing aloud on request | Working microphone transcription and generated audio |
| Backboard | Compare supported open models on the same preference-extraction evaluation set | Saved comparison of accuracy, latency, and cost where exposed; do not duplicate production memory |
| TabPFN | Predict satisfaction from consenting users' historical outing CSV | Documented real dataset, held-out evaluation, predictions, and uncertainty; only show in product if useful |
| Tinker | Fine-tune a supported open model for informal preference extraction | Baseline versus tuned model on untouched test cases; measurable improvement required |
| Arduino | UNO Q quiet-place scout: microphone-derived noise features, a small local classifier, and a timestamped user-contributed venue observation | Physical board demonstration, classifier execution, real observation reaching the app |
| Entire | Capture actual coding sessions and connect implementation decisions to the write-up | Exported or linked session evidence, with secrets removed |
| GitHub Copilot | Use an authenticated Copilot review or coding workflow on real project work | Review/session evidence and a useful accepted fix; another coding assistant does not count |

The quiet-place scout contributes a sample of ambient noise, not a guarantee that a venue is always quiet. Do not retain raw audio by default. Do not transmit uninvolved people's conversations.

## Architecture

- React + TypeScript + Vite frontend.
- Node + TypeScript API; shared Zod schemas for model and API outputs.
- Same-origin frontend and API on Render; server-side credentials only.
- Render worker connects to Temporal; Temporal handles durable scheduling, Mastra handles agent/tool logic. Avoid two independent retry loops.
- DigitalOcean inference service exposes a narrowly authenticated model endpoint. Confirm GPU availability and model fit before provisioning.
- Python service/job for TabPFN training and inference, deployed with the required supported environment.
- MongoDB Atlas owns application records; Tiger Data owns searchable venue evidence. No competing authoritative copies of votes or constraints.
- Tinker and Backboard evaluation scripts execute separately from the request path.
- UNO Q companion sends authenticated, attributed observations; it cannot modify private constraints or confirmed decisions.

Collections: outings, memberships, private_constraints, candidates, votes, decisions, feedback, workflow_runs. Venue evidence has source URL, retrieved-at timestamp, field-level provenance, and observation expiry.

API outline: POST /outings; POST /outings/:id/join; PUT /me/constraints; POST /outings/:id/discovery; GET /outings/:id/candidates; POST /outings/:id/votes; POST /outings/:id/confirm; GET /outings/:id/invite. Participant and host authorization enforced server-side on every read/write.

## Privacy and correctness

- Hosted inference is not offline and is not automatically private. Explain provider processing and obtain consent before sending private inputs.
- Separate identity-scoped constraint storage from public group state. Group endpoints never return exact private budgets, reasons, or raw preference messages.
- Redact private inputs and credentials from logs, traces, training examples, and shared coding sessions.
- Do not infer individual secret constraints through published explanations or narrow rejection messages.
- Validate model output; deterministic code checks dates, budgets, membership, vote eligibility, and finalisation.
- Search snippets are leads; fetch source pages when possible and preserve unavailable/uncertain evidence.
- Make operations idempotent and version candidates. Block duplicate confirmations and votes on old candidate versions.
- Rate-limit public joins and expensive provider requests. Provide host revocation and participant deletion.
- Label sample data and disabled integrations honestly; an SDK import or mock does not establish sponsor use.

## Implementation order and gates

1. New repository, dependency setup, Render configuration, deployment health check. Establish account/hardware access before promising all-category completion.
2. Complete create/join/private constraints/persistence/voting/invite flow. Test with separate host and participant sessions.
3. Connect Gemma, Mastra, SerpApi, and venue evidence; implement deterministic filtering and empty-result handling.
4. Add Tiger Data retrieval, Temporal durability, and redacted Sentry traces. Test interruption and restart.
5. Add ElevenLabs voice and Backboard model comparisons. Capture Entire and Copilot work from real sessions.
6. Run Tinker extraction fine-tuning and TabPFN historical-data evaluation. Validate trained model availability and measured utility before enabling them in production.
7. Build and run the UNO Q physical scout. Hardware availability is a real dependency; an emulator cannot be presented as a physical demonstration.
8. Mobile/accessibility QA, real-friend testing, fixes, public Render smoke test, and sponsor evidence audit.
9. Record a concise demo; prepare README, architecture, reproducible evaluation instructions, sponsor evidence, and DEV submission draft.

Every sponsor remains in scope. Blocked account/hardware/data work must be reported explicitly; scaffolding is not completed integration. Reassess feasibility immediately if essential access cannot be obtained before the submission window closes.

## Verification

- Private constraints never appear in another participant's response, public state, traces, or explanations.
- Model handles ambiguous text by asking/flagging rather than inventing constraints.
- Over-budget/closed/out-of-window candidates fail known hard checks.
- Search outage, model outage, and empty feasible set produce recoverable states.
- Worker restart does not duplicate jobs; repeated confirm does not duplicate decisions.
- Mobile keyboard, touch, loading, and error flows work; calendar times use the outing's timezone.
- Every category claim has an executed artifact. TabPFN uses an honest dataset split; Tinker compares identical untouched test cases.

## Required access and inputs

Real recipient + city; Render/GitHub access; DigitalOcean compute and budget; Gemma model access/terms; sponsor credentials for SerpApi, Atlas, Tiger Data, Temporal, Sentry, ElevenLabs, Backboard, Tinker, and any TabPFN service used; Copilot entitlement; Entire tooling; UNO Q board plus suitable microphone/peripheral; historical outing data with permission. Keep secrets in local ignored environment files and deployment secret settings, never chat or git.

## Delivery and submission

Deliver live Render app, independent source repository, deployment configuration, test/evaluation results, model comparison and fine-tuning evidence, physical-device evidence, real recipient feedback, demo recording, and English DEV draft using the official template.

Writing focuses on the recipient's actual problem, the before/after experience, where open AI helped, measured limitations, and meaningful sponsor usage. Never invent feedback, performance gains, or sponsor qualification. Prepare the draft and assets before requesting any publication action not explicitly authorised.

References:
- https://dev.to/challenges/hacktoberfest-weekend-2026-10-01
- https://dev.to/challenges/hf26
- https://render.com/docs/web-services
- https://docs.arduino.cc/hardware/uno-q/
- https://tinker-docs.thinkingmachines.ai/
- https://docs.priorlabs.ai/overview
