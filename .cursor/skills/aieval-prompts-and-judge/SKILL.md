---
name: aieval-prompts-and-judge
description: >-
  Documents AiEval LLM prompt roles, batch judge behavior, rubric anchors, and
  safe change checklists. Use when editing server/src/llm/prompts.ts, fixing
  judge JSON parse failures, rubric wording, or score normalization logic.
---

# Prompts and judge (maintainer)

## Prompt roles (`server/src/llm/prompts.ts`)

| Constant | Role | Output |
|----------|------|--------|
| `GENERATE_SYSTEM` | Answer models | Plain text answer to user prompt (no JSON, no rubric meta) |
| `TITLE_GENERATE_SYSTEM` / `buildTitleGenerateUser` | Stub evaluation metadata | Title only |
| `PROMPT_GENERATE_SYSTEM` / `buildPromptGenerateUser` | Stub evaluation metadata | User prompt from title |
| `JUDGE_BATCH_SCORE_SYSTEM` | Batch judge | JSON scores for **all** answers in one call |
| `JUDGE_IMPROVED_SYSTEM` | Synthesis | JSON `ImprovedAnswer` schema |
| `JSON_RETRY_SYSTEM` | Retry after invalid JSON | Single JSON object only |

Deprecated but kept for tests: `JUDGE_SCORE_SYSTEM` (single-answer judge).

## Batch judge rules

From `JUDGE_BATCH_SCORE_SYSTEM`:

- Multiple answers are indexed together — judge **may compare** to calibrate discrimination.
- Each criterion score must still match **anchor definitions** for that answer's text.
- **No invented anchor values** outside the rubric.

User message builders: `buildBatchScorePrompt`, `formatCriteriaBlock`, rubric blocks from `formatRubricBlock` in `rubric-anchors.ts`.

## Scoring pipeline (`server/src/automation/scores.ts`)

1. `parseJudgeBatchScoreResponse` — parse JSON; map criterion ids to points.
2. **Anchor snapping** — default rubric uses discrete 1–5 anchors (`snapToAnchor` / built-in anchors).
3. `pickWinner` — highest total; ties may trigger `rebalanceTiedScores` via comparative rank prompt (`JUDGE_RANK_SYSTEM` in prompts.ts).
4. `validateScoredAnswers` — every answer has complete scores before persist.

## Rubric anchors

- Built-in: `BUILT_IN_RUBRIC_ANCHORS` in `rubric-anchors.ts` (five criteria × five anchor levels).
- `usesDiscreteAnchors` / `formatRubricBlock` control what the judge sees in the prompt.
- Custom criteria: formatting differs; descriptions in DB matter more than built-in anchors.

## Improved answer schema

`buildImprovedPrompt` feeds winner + others into judge. `finalAnswer` must be a **standalone reply** to the original user prompt, not meta commentary about the evaluation.

## JSON failures

| Failure | Likely cause | Action |
|---------|--------------|--------|
| `Unexpected end of JSON` | Truncated judge response (quota/model) | Provider/preset; not always prompt bug |
| Schema mismatch | Prompt/schema drift | Align `buildBatchScorePrompt` example with parser |
| Retry loop | `JSON_RETRY_SYSTEM` in chat path | Check `chatJson` retry limit in `chat.ts` |

Enable `LOG_PROMPTS=true` and `LOG_LEVEL=debug` locally only — never commit logs with secrets.

## Change checklist

When editing judge or generate prompts:

1. Update **parser tests** in `server/src/automation/scores.test.ts` if JSON shape or anchors change.
2. Run `server/src/automation/resilient-automation.test.ts` if generate/score **contract** (call count, events) shifts.
3. Run `server/src/automation/rubric-anchors.test.ts` if anchor tables change.
4. Smoke one manual automation: generate → score on a trivial prompt.
5. Document user-facing rubric changes in README if default criteria text changes.

## Key files

| File | Responsibility |
|------|----------------|
| `server/src/llm/prompts.ts` | System prompts + user message builders |
| `server/src/automation/scores.ts` | Parse, snap, winner, tie rebalance |
| `server/src/automation/rubric-anchors.ts` | Built-in anchor text |
| `server/src/automation/criteria.ts` | `getActiveCriteria` |
| `server/src/llm/chat.ts` | `chat` / `chatJson`, retries, JSON retry |

## Related skills

- `aieval-resilient-llm` — fallback when judge call fails transiently
- `aieval-automation-debug` — operational triage
- `aieval-rubric-design` — practitioner-facing criterion design
