---
name: aieval-api-batch-runner
description: >-
  Documents AiEval REST and SSE automation APIs for headless runs and simple batch
  scripts. Use when scripting evaluations, CI gates, or polling automate/stream
  without the Angular UI.
---

# API batch runner

AiEval has no built-in dataset runner — this skill documents the **HTTP + SSE contract** for scripting one evaluation at a time.

## Base URL

- Dev API: `http://localhost:3000`
- Evaluations: `/api/evaluations`
- Settings: `/api/settings` (`llmPreset`)
- Status: `/api/status`

## CRUD

```bash
# List
curl -s http://localhost:3000/api/evaluations

# Create
curl -s -X POST http://localhost:3000/api/evaluations \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Batch eval 1",
    "prompt": "Your prompt here",
    "criteriaMode": "default"
  }'

# Get one (save full JSON for reports)
curl -s http://localhost:3000/api/evaluations/<id>

# Update
curl -s -X PUT http://localhost:3000/api/evaluations/<id> \
  -H 'Content-Type: application/json' \
  -d '{ "prompt": "Updated prompt" }'

# Delete
curl -s -X DELETE http://localhost:3000/api/evaluations/<id>
```

## Automation SSE

```
GET /api/evaluations/:id/automate/stream?phase=full|generate|score|improved&force=true|false
```

- Default `phase=full` if omitted.
- **Timeout**: 10 minutes (server and browser client).
- **Format**: `data: <JSON>\n\n` per event (standard SSE).
- Capture `runId` from early events (`status`, `slow_provider_prompt`) for cancel/choice.

### Cancel

```bash
curl -s -X POST http://localhost:3000/api/evaluations/<id>/automate/cancel \
  -H 'Content-Type: application/json' \
  -d '{"runId":"<uuid>"}'
```

### Provider choice (Ollama slow)

```bash
curl -s -X POST http://localhost:3000/api/evaluations/<id>/automate/provider-choice \
  -H 'Content-Type: application/json' \
  -d '{"runId":"<uuid>","useCloud":true}'
```

## Minimal Node SSE consumer

```javascript
import { createWriteStream } from 'fs';

const id = process.argv[2];
const phase = process.argv[3] ?? 'full';
const url = `http://localhost:3000/api/evaluations/${id}/automate/stream?phase=${phase}`;

const res = await fetch(url, { headers: { Accept: 'text/event-stream' } });
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += dec.decode(value, { stream: true });
  for (const line of buf.split('\n')) {
    if (line.startsWith('data: ')) {
      const event = JSON.parse(line.slice(6));
      console.log(event.type, event);
      if (event.type === 'complete') process.exit(0);
      if (event.type === 'error') process.exit(1);
    }
  }
  buf = buf.slice(buf.lastIndexOf('\n') + 1);
}
```

Run: `node script.mjs <evaluationId> score`

## Batch pattern (multiple prompts)

For each prompt in your list:

1. `POST /api/evaluations` with that prompt.
2. Stream `phase=full` or `generate` then `score` (safer for rate limits).
3. `GET /api/evaluations/:id` → append to results array.
4. Sleep between runs if using free-tier OpenRouter (`aieval-openrouter-free-tier`).

Store `{ evaluationId, title, winnerAnswerId, tokenUsage, scores }` in JSONL for later analysis.

## Limitations

- No parallel automation on the same evaluation (new run supersedes prior).
- Not a formal benchmark harness (no win-rate aggregation in product).
- MongoDB must be running; provider keys in `.env`.

## Related skills

- `aieval-run-model-evaluation` — UI equivalent workflow
- `aieval-evaluation-report` — format GET results
- `aieval-automation-debug` — failed streams
