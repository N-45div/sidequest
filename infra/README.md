# Deployment integrations

None of these files proves a cloud deployment. They make the deployment reviewable and reproducible once accounts are connected.

## Render web and Temporal worker

The root `render.yaml` deploys the web app. Supply Atlas credentials; the production app intentionally refuses local SQLite. Optional voice and tracing settings can be added through Render Environment without exposing values in git.

A Render background worker uses the same repository, `npm ci --include=dev && npm run build`, and `npm run worker`. Set `NODE_ENV=production`, the same `MONGODB_URI` and `MONGODB_DATABASE`, and `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_API_KEY`. Configure the same live-search, embedding and Sentry values on the worker. Then set Temporal values on the web service to enable queued discovery. Do not enable queueing without a running worker.

Temporal Cloud uses TLS when `TEMPORAL_API_KEY` is configured. Development can use a local non-TLS server. The workflow records outing ID, job ID and preference version only; the activity loads exact preferences from the application store. Retries are bounded to five attempts and ten minutes. Repeat dispatch uses the same workflow ID. The browser polls job state, rejects stale options and exposes a retry after failure.

`npm run check:temporal` downloads/runs the official local Temporal test server. It injects an activity failure and replaces the worker. [The recorded test](../evaluations/temporal-recovery.json) is local evidence, not Temporal Cloud evidence.

## DigitalOcean Gemma inference

`inference.compose.yaml` is a CPU baseline for a suitably sized DigitalOcean host; latency must be measured before choosing production hardware. GPU serving needs host drivers and additional Compose GPU configuration. No droplet has been provisioned and no billing commitment has been made.

Create an ignored `infra/.env.inference` with pinned `OLLAMA_IMAGE` and `CADDY_IMAGE`, `INFERENCE_DOMAIN`, and a random `INFERENCE_API_KEY`. Point that domain at the host and allow inbound HTTPS plus the ACME HTTP challenge. Keep SSH limited to your own IP. From `infra/`:

```sh
docker compose --env-file .env.inference -f inference.compose.yaml up -d
docker compose --env-file .env.inference -f inference.compose.yaml exec ollama ollama pull gemma3:4b
docker compose --env-file .env.inference -f inference.compose.yaml exec ollama ollama pull all-minilm
```

Choose the model after checking its license and the host's memory. Set Render `GEMMA_BASE_URL=https://your-domain/v1`, `GEMMA_MODEL=gemma3:4b`, `GEMMA_API_KEY` to the proxy secret. For 384-dimensional embeddings use the same base/key as `EMBEDDING_BASE_URL`/`EMBEDDING_API_KEY`, and `EMBEDDING_MODEL=all-minilm`. Verify vector length with the running endpoint; the app rejects wrong dimensions.

Ollama's local API does not enforce bearer authentication itself. Only Caddy publishes ports; the proxy requires the secret and exposes two POST routes. The proxy does not enable access logging of request bodies. [Ollama compatibility](https://docs.ollama.com/api/openai-compatibility), [Caddy matchers](https://caddyserver.com/docs/caddyfile/matchers).

## Tiger Data corpus

Set `TIGER_DATABASE_URL` and run `npm run setup:venues` against the intended Tiger Data database. This creates a pgvector table, full-text and HNSW indexes. Optional inference produces 384-dimensional embeddings. Source-linked SerpApi results warm at most three corpus entries per search. Retrieval fuses lexical and semantic ranks and restricts city/category and age to 30 days. Missing factual prices/access/noise stay unknown; retrieval never manufactures them. If the optional corpus is unavailable, SerpApi discovery continues.

The SQL and vector input checks are tested locally. Database execution and a retrieval-quality evaluation still require the account and real corpus. No Tiger Data results are claimed yet.

## Other live checks

- ElevenLabs: set API key and selected voice ID; try a short audio upload, review the transcript, and generate an invite after confirming. Provider fixtures in browser tests do not count as a live run.
- Sentry: set DSN on the app and worker. Explicit agent/model/tool spans are exported through a strict field allowlist. Default HTTP instrumentation is disabled to avoid leaking query credentials or private preferences. Confirm the received trace and failure diagnosis in Sentry before claiming live tracing.
- Backboard: configure `BACKBOARD_API_KEY` and `BACKBOARD_MODELS` with one to three selected open-model provider/model pairs, then `npm run eval:backboard`. It uses the same six synthetic held-out cases as Tinker with memory/web search off. Check resolved model, accuracy, latency and cost before selecting a model.
- TabPFN: install `requirements-ml.txt` in a separate environment and supply consented aggregate history to `scripts/tabpfn-eval.py --csv PATH --consented-aggregate-data`. At least 50 distinct real outings and both outcomes are required. It evaluates a chronological split against a baseline. No fake historical dataset is provided.
- Entire still needs actual session evidence. GitHub Actions automation is an explicitly accepted route in the official Copilot category, although it does not prove Copilot coding/review use. Do not enable raw session capture that would publish credentials from earlier conversation history.
