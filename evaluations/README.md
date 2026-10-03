# Tinker extraction experiment

Executed October 3, 2026. Qwen3-8B, LoRA rank 8, three optimizer steps, 24 synthetic training cases and six held-out synthetic cases.

| Metric | Baseline | Tuned |
| --- | --- | --- |
| Exact JSON match | 0/6 | 2/6 |
| Correct individual fields | 24/36 | 26/36 |

The baseline consistently encoded times as HHMM integers rather than minutes after midnight. Tuning corrected some cases, but also produced missing fields in others. This is not ready to interpret preferences reliably without validation and human review.

The same six cases were evaluated before and after training. Their wording differs from the generated training sentences; they are still a tiny synthetic set and do not establish real-world generalisation. No claim of a production-quality model is made.

`tinker-experiment.json` contains the actual predictions, expected values, measured latency, and saved checkpoint path. No API key is included. The tuned model remains an experiment, not the production preference interpreter.

## Temporal recovery

`temporal-recovery.json` records an executed official local Temporal server test. Discovery initially fails with an injected transient error; the first worker stops; a fresh worker completes the persisted retry. There were two activity attempts and three sample candidates. Workflow arguments contain IDs/version only. This demonstrates local recovery, not hosted deployment or production reliability.

Backboard and TabPFN result files are intentionally absent until those evaluations actually run. Voice browser tests use provider fixtures and are not cloud evidence.
