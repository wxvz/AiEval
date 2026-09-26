---
name: aieval-model-preset-regression
description: >-
  Runs before/after regression checks when changing LLM balanced/fast presets or
  model-presets.ts entries using golden evaluations. Use when modifying model-presets,
  LLM_PRESET defaults, or provider model rosters.
---

# Model preset regression (maintainer)

## When to run

- Edits to `server/src/llm/model-presets.ts`
- Changing `LLM_PRESET` default or `LLM_ANSWER_MODELS` / `LLM_JUDGE_MODEL`
- Swapping judge model to a different size/provider
- After adding a provider (`aieval-add-llm-provider`)

## Golden evaluations

Pick **2–3 fixed evaluations** stored in MongoDB (or export JSON via `GET /api/evaluations/:id`):

| Property | Recommendation |
|----------|----------------|
| Prompt | Stable, medium difficulty (not trivial, not huge) |
| Criteria | `default` for comparability, or same custom set across runs |
| Title | Distinct names: `golden-coding-1`, `golden-qa-1` |

Record baseline: winner label, per-answer totals, `tokenUsage`, `automatedAt`.

## Regression procedure

For each golden evaluation `id`:

```bash
# 1. Regenerate answers (destructive to answers/scores/improved)
curl -N "http://localhost:3000/api/evaluations/$id/automate/stream?phase=generate&force=true"

# 2. Wait if needed (OpenRouter free tier)

# 3. Re-score
curl -N "http://localhost:3000/api/evaluations/$id/automate/stream?phase=score&force=true"

# 4. Fetch snapshot
curl -s "http://localhost:3000/api/evaluations/$id" > "snapshot-$id-after.json"
```

Compare **before** vs **after** JSON:

- `winnerAnswerId` / `isWinner` — flag if winner flips without expected reason
- Per-answer `scores[].points` — large drift may indicate judge/model change
- `tokenUsage.total` — cost regression
- Answer `content` length — length-bias check

Optional: run `phase=improved` only if winner stable.

## Presets under test

| Preset | Behavior |
|--------|----------|
| `balanced` | Smaller/faster answer models + stronger judge |
| `fast` | All smaller models; fallback tier |

Toggle via `.env` `LLM_PRESET` or runtime `PATCH /api/settings` (`llmPreset`).
In-flight automation freezes the preset captured on `ResolvedLlmSetup` at run start; PATCH returns 409 while any run is active.

Restart API if env defaults change at boot.

## Acceptable vs concerning drift

| Acceptable | Investigate |
|------------|-------------|
| Small score shifts (1–2 points) on one criterion | Winner flip on easy prompt |
| Higher tokens with stronger judge | All models tie or all max scores |
| Different answer text with same winner | Parse errors / empty scores |

## Automate diff (optional)

```bash
diff <(jq '.answers[] | {label, total: ([.scores[].points] | add)}' before.json) \
     <(jq '.answers[] | {label, total: ([.scores[].points] | add)}' after.json)
```

## Related skills

- `aieval-prompts-and-judge` — if judge prompt also changed
- `aieval-api-batch-runner` — SSE commands above
- `aieval-interpret-evaluation-results` — explain score shifts to users
