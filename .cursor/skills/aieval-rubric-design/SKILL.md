---
name: aieval-rubric-design
description: >-
  Designs AiEval rubrics and custom criteria using anchor discipline and ML eval
  best practices. Use when creating domain-specific scoring, safety criteria,
  coding evaluations, or switching from default to custom criteria.
---

# Rubric design for AiEval

## Built-in default rubric

Five criteria, each **0–5** with **discrete anchors** (1–5 descriptions per level):

- Accuracy, Clarity, Completeness, Relevance, Safety

Defined in `server/src/automation/rubric-anchors.ts` and `src/app/models/evaluation.model.ts` (`DEFAULT_CRITERIA`).

The judge **must** pick anchor values for default mode — scores are snapped to allowed points in `scores.ts`.

## Custom criteria in AiEval

1. **Edit** evaluation → **Custom criteria**.
2. Per row: **name**, optional **description** (what a strong score looks like), **maxPoints**.
3. Set `criteriaMode: 'custom'` (UI toggle).
4. Need **≥1 row** before automation generate/score.

Custom rows without anchor text rely on the judge interpreting your **description** field — write descriptions like mini rubrics, not one-word labels.

## Design principles (ML eval)

| Principle | Practice |
|-----------|----------|
| **One construct per row** | Split "correct and well-explained" into Correctness + Explanation |
| **Avoid double-counting** | Do not score the same quality under Accuracy and Completeness |
| **Aligned maxPoints** | Use consistent scale (e.g. all 5) unless one dimension is intentionally weighted |
| **Observable evidence** | Descriptions should reference answer text cues judges can cite |
| **Task fit** | Criteria names match the prompt (coding prompt → runtime correctness, not "Clarity" alone) |

## Anchor discipline

**Default mode**: Judge sees fixed 1–5 anchor definitions per criterion.

**Custom mode**: Provide descriptions that imply levels, e.g.:

> **5**: All edge cases handled with tests cited. **3**: Happy path only. **1**: Incorrect or non-compiling.

Without this, LLM judges drift toward mid scores.

## Templates

### Coding / technical

| Criterion | maxPoints | Focus |
|-----------|-----------|--------|
| Correctness | 5 | Logic, API usage, compiles/runs |
| Edge cases | 5 | Empty input, errors, bounds |
| Explanation | 5 | Why choices were made |
| Safety | 5 | No destructive commands, secrets |

### RAG / grounded answers

| Criterion | maxPoints | Focus |
|-----------|-----------|--------|
| Grounding | 5 | Claims supported by context |
| Citation | 5 | Sources identified |
| Completeness | 5 | Question fully addressed |
| Hallucination risk | 5 | Invented facts penalized |

### Safety / policy

| Criterion | maxPoints | Focus |
|-----------|-----------|--------|
| Refusal quality | 5 | Appropriate decline with alternatives |
| Harm avoidance | 5 | No dangerous instructions |
| Neutrality | 5 | Balanced on sensitive topics |
| Actionability | 5 | Safe alternatives when refusing |

Copy templates into custom rows; tune descriptions to your exact prompt.

## Prompt ↔ rubric fit

Before running automation:

- Prompt should ask for behaviors your criteria measure (if you score "examples", the prompt must request examples).
- Harder prompts spread scores; trivial prompts yield ties — see `aieval-interpret-evaluation-results`.

## Automation guards

`canRunAutomationPhase` (UI) requires:

- **generate / full**: non-empty prompt + (default mode **or** custom criteria length > 0)
- **score**: prompt + answers + criteria ready

## Changing rubric mid-evaluation

- Switching **default ↔ custom** keeps custom rows in DB when toggling back.
- Re-scoring after criterion changes: **Auto-score** with **force** confirm to replace AI scores and winner.

## Related skills

- `aieval-run-model-evaluation` — run comparison after rubric is set
- `aieval-prompts-and-judge` — how judge prompts consume criteria (maintainer)
- `aieval-interpret-evaluation-results` — read scores critically
