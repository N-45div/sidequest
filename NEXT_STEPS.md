# Remaining end-to-end work

The source is pushed to `N-45div/sidequest`. The local app runs on port 3100. Current executed evidence: 16 backend tests, desktop/mobile browser flows, voice consent/review flows using fixtures, a real local Temporal recovery test, and the earlier real Tinker fine-tuning experiment.

## Connect live services

Enter secrets directly into ignored `.env` for development and Render Environment for deployment. Use `.env.example` for names; never commit values.

| Needed | Enables | Verification |
| --- | --- | --- |
| Atlas URI | Connected on public Render service | Write/read and independent host/guest API checks passed; redeployment persistence check recorded separately |
| SerpApi key | Real source-linked venues | A live city search, uncertainty labels, unavailable-search recovery |
| DigitalOcean host/domain and Gemma endpoint | Open-model preference extraction | Consented draft, correct time encoding, invalid-output recovery |
| Tiger Data URL + embedding endpoint | Hybrid venue corpus | Execute migration, indexed real venues, retrieval quality |
| Temporal account/address + Render worker | Hosted durable discovery | Replace worker during a real job; complete once |
| Sentry DSN | Cloud agent tracing | Inspect redacted spans and a diagnosed provider failure |
| ElevenLabs key + voice ID | Real transcript and spoken invite | Consent, review, actual playable output |
| Backboard key + selected open models | Model comparison | Run same held-out synthetic cases and retain real results |
| TabPFN account + consented real aggregate history | Historical prediction experiment | Chronological holdout versus baseline; no invented attendance |

Follow [infra/README.md](infra/README.md) for runnable deployment and evaluation commands. Cloud resources have not been provisioned by these files.

## Submission evidence

Hardware and Arduino sponsor work have been removed from the active release scope. Focus on the core Render/Atlas release and integrations with usable credentials/evidence.

Entire session evidence remains pending. GitHub Actions build/test automation is executed and passes; the official GitHub Copilot category explicitly accepts Actions automation. No Copilot coding/review session is claimed. Any captured session needs secret review before sharing.

The requested persona is hypothetical. The sample stays fictional; no real friend or feedback is claimed. The public Render deployment and DEV draft are complete. Real recipient validation, a demo recording and publication remain outstanding. The live app is https://sidequest-lzrz.onrender.com.
