---
name: aieval-resilient-llm
description: >-
  Explains AiEval slot-based answer generation, model/provider fallback chains,
  checkpointing, and Ollama slow-provider choice. Use when modifying resilient-llm,
  fallback behavior, provider choice, concurrency env vars, or resume semantics.
---

# Resilient LLM patterns (maintainer)

## Slot model (generate)

Three answer **slots** map to `setup.answerModels` (one model per slot).

| Function | Purpose |
|----------|---------|
| `mapAnswersToSlots` | Place existing answers into slots by `label` |
| `pendingSlotIndices` | Slots still empty after partial run |
| `answersFromSlots` | Rebuild `answers[]` from filled slots |

**Resume**: Evaluation with `< 3` answers, no winner, valid prompt/criteria → generate phase fills **only pending slots** (no force).

**Checkpoint**: `persistGenerateCheckpoint` writes partial answers to Mongo before sequential fallback; SSE `step_paused`.

## Generate retry flow

1. **Concurrent** first pass (`mapWithConcurrency`, `LLM_CONCURRENCY`).
2. Per slot: catch only `isRateLimitExhausted` from parallel wave.
3. If pending slots remain → DB checkpoint → `step_paused` → **sequential** `callSingleModelWithFallback` per slot.

## Fallback candidates (`buildFallbackCandidates`)

Order for a given role (`answer` slot N or `judge`):

1. Configured model on **current provider**
2. **Fast preset** model on same provider (if different from active)
3. For each **later** provider in `PROVIDER_ORDER` (`ollama` → `groq` → `openrouter` → `gemini` → `huggingface`) where `isProviderAvailable`:
   - Map role to that provider's models via `resolveProviderModelForCall` / `minimalSetupForMapping`

`callSingleModelWithFallback` tries candidates in order; `skipKeys` avoids re-trying primary models already attempted.

## Eligible vs fail-fast (`isFallbackEligible`)

**Eligible** (try next candidate):

- Rate limit errors (`isRateLimitError`)
- Transient network: `fetch failed`, `econnreset`, `etimedout`, `socket hang up`

**Not eligible** (fail run immediately):

- Invalid JSON from judge (after retries)
- Auth / configuration errors
- Validation errors (`validateAnswersForScoring`, empty content)

## Judge and improved

Same `buildFallbackCandidates(setup, 'judge', 0)` + `callSingleModelWithFallback` for:

- Batch score
- Tie-break rank (if totals tie)
- Improved synthesis

## Ollama slow path

When a call exceeds `LLM_SLOW_FALLBACK_MS`:

1. SSE `slow_provider_prompt` with `runId`
2. UI modal → `POST /api/evaluations/:id/automate/provider-choice` `{ useCloud, runId }`
3. `waitForProviderChoice` in `provider-choice.ts` (30 min timeout)
4. `onCloudProviderSwitch` mutates `setup` in place for remainder of run

`run-registry.ts`: new automation **supersedes** prior run (aborts + rejects pending choice).

## Cancellation

- `registerAutomationRun` / `cancelAutomationRun` keyed by `evaluationId`
- `assertNotCancelled` → `AutomationError('Automation cancelled.', step)`

## Environment knobs

| Variable | Effect |
|----------|--------|
| `LLM_CONCURRENCY` | Parallel answer slots in first wave |
| `LLM_INTER_CALL_DELAY_MS` | Delay between LLM calls |
| `LLM_PRESET` | `balanced` vs `fast` model roster |
| `LLM_SLOW_FALLBACK_MS` | Ollama → cloud prompt threshold |
| `LLM_REQUEST_TIMEOUT_MS` | Per-request fetch timeout |

Runtime preset also via `PATCH /api/settings` (frozen onto `ResolvedLlmSetup.preset` at resolve;
`buildFallbackCandidates` uses that value, not a live re-read of `getLlmPreset()`).

## Extension points (no plugin registry today)

| Seam | File |
|------|------|
| Fallback list | `buildFallbackCandidates`, `isFallbackEligible` |
| Per-call wrap | `createLlmCallContext` in `chat.ts` |
| Phase guards | `prepareDocForPhase` in `run-evaluation.ts` |
| Progress hooks | `ProgressCallback` / SSE `onProgress` in automation route |

## Tests to run after changes

```bash
npx vitest run server/src/automation/resilient-llm.test.ts server/src/automation/resilient-automation.test.ts
```

Before merge: `npm run ci` (see `aieval-keep-tests-current`).

## Related skills

- `aieval-automation-debug` — user-facing recovery
- `aieval-openrouter-free-tier` — quota-specific behavior
- `aieval-automation-testing` — mock patterns
