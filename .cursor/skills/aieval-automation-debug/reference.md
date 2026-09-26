# Automation debug reference

## LogEvents (NDJSON `event` field)

| Event | Typical step |
|-------|----------------|
| `automation.started` | Run begin |
| `automation.provider_resolved` | Provider + models chosen |
| `automation.generating` | Answer generation |
| `automation.answer_generated` | One slot done |
| `automation.scoring` | Batch judge |
| `automation.scored` | Scores applied |
| `automation.winner_picked` | Winner set |
| `automation.improved_generating` | Improved synthesis |
| `automation.improved_done` | Improved saved |
| `automation.pipeline_step` | Phase transitions ("Next step: scoring") |
| `automation.complete` | Success |
| `automation.failed` | Run failed |
| `automation.cancelled` | User or superseded |
| `automation.provider_choice` | Ollama slow → user choice |
| `llm.rate_limit` | 429 after retries |
| `llm.retry` | Backoff retry |
| `llm.call_failed` | Non-retryable or exhausted |
| `llm.slow_fallback` | Ollama exceeded `LLM_SLOW_FALLBACK_MS` |
| `sse.event` | Event type mirrored to client (debug) |

## API (automation)

Base: `/api/evaluations/:id`

| Method | Path | Body / query |
|--------|------|----------------|
| GET | `/automate/stream` | `?phase=generate\|score\|improved\|full` (default `full`), `?force=true` |
| POST | `/automate/cancel` | `{ "runId": "..." }` |
| POST | `/automate/provider-choice` | `{ "runId": "...", "useCloud": true\|false }` |

SSE: `data: {JSON}\n\n` per event. Client timeout: 10 minutes (matches server).

## Pipeline order (`phase=full`)

1. Metadata (only if title and prompt are `(automation pending)` and no answers)
2. Generate — 3 answer models (concurrent, then fallback per slot)
3. Checkpoint answers to DB
4. Score — one batch judge call
5. Winner + `automatedAt`
6. Improved answer synthesis

## Inspect logs locally

```bash
# If LOG_FILE is set or using default logs path
rg '"event":"llm.rate_limit"' logs/server.ndjson
rg '"evaluationId":"<id>"' logs/server.ndjson
```

Set `LOG_FORMAT=text` for readable terminal lines; file remains NDJSON.
