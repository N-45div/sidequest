# Evaluations

## Tinker study: the production model

Executed October 4, 2026, recorded in `tinker-study.json`. Qwen3.5-4B, LoRA rank 16, 75 optimizer steps on 800 synthetic English and Hinglish messages. Every model gets the same prompt (`server/extraction-prompt.txt`). Two held-out sets: 50 hand-written messages (`extraction-heldout.json`, written separately from the generator, including typos and two prompt-injection attempts) and 100 unseen generated ones. A case counts only if all six fields are right.

| Model | Hand-written (50) | Generated (100) |
| --- | --- | --- |
| Qwen3.5-4B zero-shot | 34 | 58 |
| Qwen3.5-4B three-shot | 35 | 65 |
| Qwen3.6-27B zero-shot | 50 | 91 |
| Qwen3.5-4B tuned | 50 | 99 |

The untuned misses were mostly bare hours read as morning ("4 to 6" as 04:00), every space ticked when none was named, an unmentioned budget set to 0, and "stairs are no problem" read as needing step-free access. The report lists every hand-written row and every generated miss. All messages are synthetic, so this measures the task, not real students. The tuned checkpoint serves live drafts, and students still review every draft.

## TabPFN busyness forecasts

`tabpfn-busyness.json`: TabPFN v2 open weights, run locally, on Google popular-times history for 39 Bengaluru study spots (3,254 venue-hours) found through SerpApi. Five folds grouped by venue, so every score is for a place the model never saw. TabPFN ties a type-and-hour average and gradient boosting on mean absolute error (14.5 against 14.8 and 14.4). It finds more of the quiet hours (63% against 42% and 52%), with similar precision (59% against 60% and 62%). Thirty-nine venues is a small sample. Popular times measure crowding, not noise. Raw search data stays in ignored `artifacts/`.

## The first Tinker experiment

Executed October 3, 2026. Qwen3-8B, LoRA rank 8, three optimizer steps, 24 synthetic training cases and six held-out synthetic cases.

| Metric | Baseline | Tuned |
| --- | --- | --- |
| Exact JSON match | 0/6 | 2/6 |
| Correct individual fields | 24/36 | 26/36 |

The baseline consistently encoded times as HHMM integers rather than minutes after midnight. Tuning corrected some cases, but also produced missing fields in others. This is not ready to interpret preferences reliably without validation and human review.

The same six cases were evaluated before and after training. Their wording differs from the generated training sentences; they are still a tiny synthetic set and do not establish real-world generalisation. No claim of a production-quality model is made.

`tinker-experiment.json` contains the actual predictions, expected values, measured latency, and saved checkpoint path. No API key is included. This first experiment was superseded by the study above.

## Temporal recovery

`temporal-recovery.json` records an executed official local Temporal server test. Discovery initially fails with an injected transient error; the first worker stops; a fresh worker completes the persisted retry. There were two activity attempts and three sample candidates. Workflow arguments contain IDs/version only. This demonstrates local recovery, not hosted deployment or production reliability.

A Backboard comparison file is absent because the Backboard account had no credit for model calls when the script ran. Voice browser tests use provider fixtures and are not cloud evidence.

## Public deployment

`render-live.json` records actual API execution against https://sidequest-lzrz.onrender.com with MongoDB Atlas. Fictional test participants cover independent joining, private preferences, authorization, deterministic filters, votes, idempotent confirmation and calendar download. Run `node scripts/live-check.mjs <public-url>` before redeployment, then `node scripts/live-check.mjs <public-url> --verify-persistence` after the new deployment is live. The credential needed for read-back stays only in ignored `artifacts/`.

## SerpApi live discovery

`serpapi-live.json` records real Google Maps results returned by the public Render app through Mastra. The checks verify live mode, source URLs, retrieval timestamps and preservation of unknown costs, noise and access. The organiser is fictional; venue names and sources are actual search output. The API key and participant credential are excluded.
