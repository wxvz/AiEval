---
name: aieval-prompt-variant-benchmark
description: >-
  Compares prompt wording variants in AiEval using separate evaluations or forced
  regenerate runs. Use for A/B prompt testing, prompt iteration, or regression on
  prompt wording without a built-in dataset runner.
---

# Prompt variant benchmark (practitioner)

## Method

AiEval compares **models** on a **fixed prompt** per evaluation. To benchmark **prompt variants**, hold models/preset constant and vary the prompt across **separate evaluations** (or one evaluation with forced regenerate — see below).

### Recommended: one evaluation per variant

| Variant | Steps |
|---------|--------|
| A | Create eval with `prompt A` → generate → score |
| B | Create eval with `prompt B` → generate → score |
| C | Optional third variant |

Same `criteriaMode` and criteria rows across variants for fair comparison.

### Compare metrics

| Metric | Source |
|--------|--------|
| Winner model label | `winnerAnswerId` → answer `label` |
| Score spread | Per-criterion points on Compare |
| Total tokens | `tokenUsage` on evaluation |
| Improved quality | `improvedAnswer.finalAnswer` (subjective) |

Winner **across variants** is not automatic — compare winners and scores manually or export JSON (`aieval-evaluation-report`).

## Same evaluation, swap prompt (use carefully)

1. `PUT` new `prompt` on existing evaluation.
2. **Generate answers** with **force** (replaces answers, clears winner/improved).
3. **Auto-score** with **force**.

Only valid if you want sequential A/B on one record; historical variant A is lost unless exported first.

## Controlling variables

| Hold constant | Vary |
|---------------|------|
| `LLM_PRESET`, provider keys | Prompt text |
| Criteria set | — |
| Time of day / quota | Order of runs (run B after cooldown if 429) |

Document preset and date in your notes — judge models change behavior over time.

## Rate limits

Run variants **sequentially** with pauses on OpenRouter free tier. Prefer `phase=generate` then `phase=score` per variant instead of three full automations back-to-back.

## Limitations

- No CSV dataset importer in product (Tier 4 `aieval-dataset-benchmark` would need code).
- No aggregated win-rate dashboard — track in spreadsheet or script output from `aieval-api-batch-runner`.
- Judge variance: re-scoring same answers with `force` tests judge stability, not prompt change.

## Quick script outline

```bash
for prompt in "Variant A text" "Variant B text"; do
  id=$(curl -s -X POST http://localhost:3000/api/evaluations \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg p "$prompt" '{title:"A/B",prompt:$p,criteriaMode:"default"}')" \
    | jq -r '.id')
  curl -N "http://localhost:3000/api/evaluations/$id/automate/stream?phase=generate"
  sleep 120
  curl -N "http://localhost:3000/api/evaluations/$id/automate/stream?phase=score"
  curl -s "http://localhost:3000/api/evaluations/$id" >> results.jsonl
done
```

## Related skills

- `aieval-run-model-evaluation` — baseline workflow
- `aieval-api-batch-runner` — HTTP details
- `aieval-interpret-evaluation-results` — read outcomes
