# Testing SideQuest

Run commands from the repository root. The study-circle release passed **18 deterministic tests** and the production build. Provider checks and browser evidence have separate scope.

## Choose a check

```mermaid
flowchart TD
    A[Change to verify] --> B[Build and deterministic tests]
    B --> C{Changed area}
    C -->|Interface| D[Desktop and mobile browser checks]
    C -->|Temporal| E[Local worker recovery]
    C -->|Deployment| F[Public API and live search]
    C -->|Models| G[Separate evaluation]
    F --> H[Completed redeployment]
    H --> I[Persistence read-back]
```

## Fast checks: no provider account required

```powershell
npm ci
npm run build
npm test
```

Build runs TypeScript validation and Vite bundling. Tests use Node's runner, isolated in-memory SQLite, simulated providers and injected activities. They do not require a listening app or load `.env` through the test command. Keep optional provider variables out of the test process for deterministic results.

| File | Cases | Coverage |
| --- | --- | --- |
| `tests/api.test.mjs` | 9 | Participant isolation, outsiders, validation, host permissions, stale votes, confirmation, IST calendar, optimistic writes and dispatch failures |
| `tests/integrations.test.mjs` | 6 | Mastra execution, vector validation, telemetry redaction, durable invalidation/idempotency and voice fixtures |
| `tests/preview.test.mjs` | 1 | Production storage refusal and explicit sample-only memory preview |
| `tests/study.test.mjs` | 2 | Free study-space constraints, library query and unresolved campus/access/noise facts |

Focused run: `node --test tests/study.test.mjs`.

[GitHub Actions](.github/workflows/check.yml) runs install/build/tests on `main` pushes and pull requests. CI does not execute browser, paid-provider or cloud persistence checks.

## Local browser checks

Install Google Chrome, build the app and run `npm start` in another terminal on **port 3100**. Sample mode works with development SQLite and no provider keys.

```powershell
node scripts/browser-check.mjs
node scripts/voice-ui-check.mjs
```

| Script | Covers |
| --- | --- |
| `browser-check.mjs` | Sample circle, preference edits, voting, confirmation, ICS, refresh, independent guest, mobile overflow and page errors |
| `voice-ui-check.mjs` | Consent gates, unsaved transcript/draft review and confirmed audio invitation UI |

Screenshots are written into ignored `artifacts/`. Voice responses and audio are fixtures; they do not prove playable ElevenLabs output or live model quality. The full browser suite ran before the study-circle rename; renamed scripts are available, and the new public homepage/shortlist were checked separately. A previous browser run is not a new full run.

Manual release pass: create/join in independent sessions, save different budgets, discover, vote and confirm. Check peer preference privacy. At 390px width, check headings and horizontal overflow. Before confirmation, edit a preference and verify previous options/votes clear.

## Atlas connectivity

Configure the ignored environment with `MONGODB_URI`, `MONGODB_DATABASE=sidequest` and suitable network access:

```powershell
node --env-file=.env scripts/atlas-check.mjs
```

This pings Atlas, inserts a randomly identified `deployment_checks` document, reads it back and deletes that document during cleanup. It is restricted to the `sidequest` database. It checks read/write access, not backups or availability guarantees.

## Public API release check

Use the intended HTTPS service. This creates fictional participants and a confirmed sample plan in its database:

```powershell
node scripts/live-check.mjs https://sidequest-lzrz.onrender.com
```

Assertions cover Atlas storage, preview disabled, create/join, private preferences, outsider rejection, host-only discovery/confirmation, known filters, voting, idempotent confirmation and ICS.

The public report is `evaluations/render-live.json`. Private read-back state is `artifacts/live-check-session.json`, containing a credential: never commit or upload it. Repeating the initial run replaces that artifact and creates another group; earlier groups are not removed.

### Persistence across deployment

Run the initial check first, complete a new deployment and confirm it is **live**, then read back using the same service and private artifact:

```powershell
python scripts/render-deploy.py --status
node scripts/live-check.mjs https://sidequest-lzrz.onrender.com --verify-persistence
```

The second command compares the saved decision exactly. Without an intervening completed deployment, it is not restart-persistence evidence. Inspect report changes before committing them.

## Real SerpApi discovery

The public service needs Atlas and a valid server-side search key:

```powershell
node scripts/serpapi-live-check.mjs https://sidequest-lzrz.onrender.com
```

This creates a fictional organiser, saves library preferences and executes actual Maps discovery through Mastra. It verifies non-sample cards, Maps sources, timestamps and unknown cost/noise/access. `evaluations/serpapi-live.json` excludes credentials. The check consumes provider searches and creates a test group; venue order can change.

Success does not verify campus entry, room availability, hours or group-discussion suitability. Unknown values must not become claims of suitability.

## Temporal recovery

```powershell
npm run check:temporal
```

The script downloads/runs the official local test server, injects failure, stops the first worker and starts a replacement. It checks two attempts, completion, stored candidates and no preference payload in workflow history. Output: `evaluations/temporal-recovery.json`.

Hosted recovery additionally needs a worker, shared Atlas, Temporal credentials and a real queued job interrupted during execution. Enable queueing only after the worker is running; see [infra/README.md](infra/README.md).

## Optional evaluations

| Tool | Command / guide | Prerequisite and limit |
| --- | --- | --- |
| Tinker study | `python scripts/tinker_study.py baseline`, then `python scripts/tinker_study.py train` | `TINKER_API_KEY`; scores zero-shot, three-shot, Qwen3.6-27B and the tuned model on the same 50 hand-written and 100 generated messages; writes `evaluations/tinker-study.json` |
| Live extraction | Set `MODEL_*`, open a circle's preferences, type a message and choose *Interpret, then review* | Uses the tuned model on Tinker's OpenAI-compatible endpoint, which Tinker describes as suited to low traffic |
| Backboard | `npm run eval:backboard` | `BACKBOARD_API_KEY` with credit for model calls; same 50 hand-written messages and prompt as the Tinker study |
| Busyness data | `python scripts/busyness_collect.py --lookups 100` | `SERPAPI_API_KEY`; spends one credit per search and per place lookup; raw data stays in ignored `artifacts/busyness/` |
| TabPFN busyness | `python scripts/tabpfn_busyness.py evaluate`, then `publish` | `pip install tabpfn` (v2 open weights, local CPU); `publish` needs `MONGODB_URI`; writes `evaluations/tabpfn-busyness.json` |
| Legacy Tinker | `python scripts/tinker_experiment.py --train` | The first six-case outing experiment, kept as history |
| Tiger Data | `npm run setup:venues` | Changes the intended database; live retrieval evaluation still needed |
| ElevenLabs / Sentry | [Integration checks](infra/README.md) | Actual audio/received trace; fixtures are insufficient |

Do not rerun paid experiments just to produce a green report. Tinker's historical fixtures predate the study-circle refinement and remain historical evidence.

## Evidence and troubleshooting

[Evaluation index](evaluations/README.md) | [Render](evaluations/render-live.json) | [SerpApi](evaluations/serpapi-live.json) | [Temporal](evaluations/temporal-recovery.json) | [Actions](evaluations/github-actions.json)

| Symptom | Check |
| --- | --- |
| SQLite startup failure | Node 24+ and development mode |
| Production refuses storage | Atlas URI; preview is not durable hosting |
| Atlas authentication/selection failure | Saved credential, URI encoding and actual outbound address allowlist |
| Old UI | Rebuild `dist`, reload the intended app and verify port |
| Live spaces disabled | Persistent hosted storage and configured key; capability is not provider health |
| Job remains pending | Worker, task queue/namespace, shared Atlas and worker-side search key |
| 401 in a new session | Rejoin; credential recovery is not implemented |
| 409 on save/vote/confirm | Refresh; preferences/version or document revision changed |

Keep secrets, raw sessions and private artifacts out of reports/recordings. Passing tests does not establish real-recipient feedback or competition eligibility.
