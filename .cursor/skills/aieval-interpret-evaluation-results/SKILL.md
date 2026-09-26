---
name: aieval-interpret-evaluation-results
description: >-
  Interprets AiEval comparison scores, batch judge behavior, tie-breaks, and red
  flags; suggests when to re-score or override the winner. Use when explaining
  compare page results, disagreeing with AI scores, or reviewing automation output.
---

# Interpret evaluation results

## How scores are produced

1. **Batch judge** — One LLM call scores **all** answers together (`JUDGE_BATCH_SCORE_SYSTEM`).
2. Comparison calibrates **relative** discrimination; each score must still match rubric **anchors** for that answer.
3. **Winner** — Highest total points; exact ties may invoke a **ranking** pass to spread scores slightly.
4. **`automatedAt`** — Timestamp when AI scoring last completed; manual edits afterward are still valid.

Scores are **LLM-as-judge** signals, not human ground truth.

## Reading the Compare page

| UI element | Meaning |
|------------|---------|
| Model chips | Switch between answers |
| Per-criterion inputs | Points / max for active rubric row |
| Total / % | Sum of criterion points |
| Winner badge | `isWinner` / `winnerAnswerId` |
| AI banner | Scores came from automation; you may edit |

**Notes** on answers (if present) often carry judge rationale — read before overriding.

## Red flags

| Pattern | Likely issue | Suggested action |
|---------|--------------|------------------|
| All models within 1 point on every criterion | Prompt too easy or vague | Harder prompt; sharper custom criteria |
| One model wins every criterion by wide margin | Possible judge bias or length bias | Inspect answer length; re-score with `force`; try different preset |
| Scores cluster at 3 on default rubric | Anchor compression | Custom criteria with clearer level descriptions |
| Winner contradicts your read | Judge missed nuance | Manual score edit + **Mark winner** |
| High tokens, low score spread | Expensive tie | `fast` preset; shorter prompt |

## Batch judging effects

- A strong answer next to a weak one can sharpen scores for both (contrast effect).
- Re-scoring after **changing criteria** requires **Re-score** (force) — old scores are not comparable.
- Re-scoring after **only changing prompt** without regenerating answers judges old answers against a new task — prefer new evaluation or regenerate answers.

## Tie-break behavior

When totals tie after batch score, server may run comparative ranking and scale scores (`rebalanceTiedScores` in `scores.ts`). Small point differences after tie-break are intentional, not rounding bugs.

## Manual override workflow

1. Edit criterion points on Compare.
2. **Mark winner** for the answer you prefer (automation winner is not locked).
3. Open **Improved** — generate or edit using your chosen winner.

## When to re-run automation

| Goal | Action |
|------|--------|
| New model answers | Edit → **Generate answers** (force if replacing) |
| New AI scores | Compare → **Auto-score** (force if replacing) |
| New improved draft | Improved → **Generate improved answer** |
| Fair prompt A/B | Separate evaluations per prompt (`aieval-prompt-variant-benchmark`) |

## Related skills

- `aieval-run-model-evaluation` — how to run phases
- `aieval-rubric-design` — fix criteria before re-score
- `aieval-automation-debug` — failed runs
- `aieval-evaluation-report` — export for stakeholders
