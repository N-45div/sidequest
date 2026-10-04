# Sponsor integration evidence

Current feasible sponsor evidence; hardware is excluded from the active scope. Do not equate an environment variable or dependency with a completed integration.

| Sponsor | Current state | Remaining evidence |
| --- | --- | --- |
| Render | Public Node web service deployed and public API flows verified | Confirmed outing survived completed redeployment; see evaluations/render-live.json |
| Gemma | Not used: the live model is Qwen3.5-4B, since Tinker does not offer Gemma | None claimed |
| DigitalOcean | Authenticated inference Compose stack prepared | Account access, sized compute, model deployment and latency measurement |
| Mastra | Discovery and interpretation workflows run in production; interpretation calls the tuned open model | SerpApi workflow executed with actual search results |
| SerpApi | Actual Google Maps search returned real Bengaluru venues through Mastra locally and on public Render | Verified public capability, discovery and source links; see evaluations/serpapi-live.json |
| MongoDB Atlas | Real Atlas write/read passed; deployed independent host/guest privacy and decision flows passed | Post-redeployment read-back recorded in evaluations/render-live.json |
| Tiger Data | Hybrid retrieval, corpus indexing and SQL migration implemented; vector validation tested | Database/embedding access, executed SQL and retrieval evaluation |
| Temporal | Real local server verified persisted activity retry across worker replacement; app queueing and worker implemented | Atlas-backed Render worker and Temporal Cloud verification |
| Sentry Agent Tracing | Explicit agent/model/tool spans and export redaction implemented and tested | DSN, received real trace and failure diagnosis in Sentry |
| ElevenLabs | Live on Render: Scribe transcribes consented voice notes into the tuned model; confirmed plans become spoken invitations | Production transcription and invitation checked October 4 |
| Backboard | Same-fixture open-model evaluation script prepared, memory disabled | Key/selected models and actual comparison results |
| TabPFN | Chronological real-history evaluation script prepared; no dataset supplied | Consented real outing data, account and honest evaluation |
| Tinker | LoRA fine-tune of Qwen3.5-4B serves live drafts through Tinker's OpenAI-compatible endpoint; 34/50 → 50/50 hand-written, 58/100 → 99/100 generated | Tinker describes that endpoint as suited to low traffic; synthetic evaluation sets |
| GitHub Copilot category | Actual GitHub Actions build/test automation verified successful; the official category explicitly accepts Actions automation | Describe Actions honestly; no Copilot coding or review session is claimed |

| Entire | Official CLI 0.11.3 installed, checksum verified; local Codex hooks enabled, telemetry and checkpoint uploads disabled | Hook trust review, actual SideQuest capture, credential review and safely shareable session link; zero imported sessions so far |

No prize qualification is asserted by this file. Update rows only when the relevant executed artifact exists.
