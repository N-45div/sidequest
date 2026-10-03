# SideQuest

Private preferences. A shared decision. An outing your group can say yes to.

Independent new project for the Hacktoberfest Weekend Challenge. The current persona and sample group are hypothetical, as requested; no real-friend validation or feedback is claimed.

## Working now

- Create an outing and invite people through a shared link.
- Separate participant sessions with server-side authorization.
- Save exact budgets, availability, interests, quiet-place and step-free requirements privately.
- Filter and rank clearly labelled illustrative activities without external accounts.
- Vote, confirm once, and download an IST-aware calendar entry.
- Invalidate old candidates and votes when preferences or membership change.
- Persist local development data in SQLite; use MongoDB Atlas when configured.
- Optional SerpApi live discovery and Gemma-compatible extraction adapters, awaiting live verification with credentials.
- UNO R3 sketch, serial bridge, and authenticated observation endpoint. Hardware is not physically verified.
- Tinker connectivity verified; actual bounded fine-tuning experiment completed. Exact JSON matches improved from 0/6 to 2/6 synthetic cases; this remains too unreliable for production. See [evaluations](evaluations/README.md).

This is a working prototype, not a completed all-sponsor submission or a deployed Render service. See [SPONSORS.md](SPONSORS.md) for accurate integration status.

## Run locally

Requires Node 24 or later.

```powershell
npm ci
npm run build
npm start
```

Open http://localhost:3100. For frontend development, run `npm run server` and `npm run dev` in separate terminals, then use http://localhost:5174.

Participant credentials are stored in sessionStorage on the joining device. Share the invite link, not your private credential. A different device/tab session may require rejoining; credential recovery is not implemented yet.

## Checks

```powershell
npm test
node scripts/browser-check.mjs
```

The browser check requires installed Google Chrome and a running app on port 3100. It covers desktop and mobile flows, separate participant contexts, preference updates, voting, confirmation, calendar download, persistence after refresh, and overflow. Screenshots go into ignored `artifacts/`.

## Render deployment

`render.yaml` defines a Node web service serving the built frontend and API together. The server binds `0.0.0.0` and Render's `PORT`.

1. Publish this independent repository to your GitHub account.
2. Create a Render Blueprint using this repository.
3. Configure `MONGODB_URI` for your Atlas database in Render secrets, with suitable network access and least-privilege database credentials. No credential belongs in git.
4. For live search, configure `SERPAPI_API_KEY`. For Gemma inference, configure `GEMMA_BASE_URL`, `GEMMA_API_KEY` where required, and `GEMMA_MODEL`.
5. Verify `/api/health`, create/join from separate devices, privacy isolation, and calendar download on the actual public URL.

Production deliberately refuses to start without MongoDB. Render ephemeral filesystem storage is not treated as durable participant storage. No live deployment has been created yet.

## Tinker experiment

Use an isolated Python virtual environment. The local ignored `.env` contains the user-supplied Tinker credential; never print or commit it.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install tinker pyserial
.\.venv\Scripts\python.exe scripts\tinker_check.py
.\.venv\Scripts\python.exe scripts\tinker_experiment.py --train
```

The experiment is bounded to Qwen3-8B, rank 8, three optimizer steps, 24 synthetic training cases, and six distinct held-out synthetic cases. It records baseline/tuned field and exact-match scores and a checkpoint. This is a smoke evaluation, not evidence of general usefulness. Results can show no improvement; do not claim otherwise. Training/sampling use provider credits or incur provider usage charges.

## Hardware

See [hardware/README.md](hardware/README.md). UNO R3 requires an external analog microphone to measure an ambient signal. Raw ADC amplitude is not decibels, a calibrated classifier, or verified venue accessibility. The challenge's UNO Q category is not satisfied by an R3.

## Boundaries

Live search prices, date-specific hours, travel time, quietness, and step-free access currently remain unverified. Model interpretation requires explicit provider-processing consent and participant review. Typed controls work without AI.

Hypothetical people and demo activity facts are labelled. The challenge asks for a real friend or loved one; a real recipient and actual feedback remain outstanding submission work.

This project does not include Parallel source, assets, interface, conference allocation, or conference briefing logic. The main workflow is private group preferences and collaborative outing decisions.
