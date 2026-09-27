---
name: aieval-evaluation-report
description: >-
  Produces stakeholder-ready summaries from AiEval evaluations using a standard
  report template. Use when sharing comparison results, writing up a model eval,
  or exporting GET /api/evaluations/:id data.
---

# Evaluation report

## Data source

- **UI**: Compare + Improved pages
- **API**: `GET http://localhost:3000/api/evaluations/<id>`
- **Export**: Save JSON; optional `jq` for tables

## Report template

Copy and fill:

---

### Evaluation: {title}

**ID:** `{id}`  
**Created:** `{createdAt}`  
**Automated:** `{automatedAt or "manual"}`  
**Token usage:** `{tokenUsage.total}` total (`{estimated ? "estimated" : "provider"}`)

#### Task

> {prompt}

#### Rubric

| Criterion | Max points | Mode |
|-----------|------------|------|
| {name} | {maxPoints} | {criteriaMode} |

*(For default mode, list Accuracy, Clarity, Completeness, Relevance, Safety.)*

#### Model answers (summary)

| Model | Total | % | Winner |
|-------|-------|---|--------|
| {label} | {sum points} | {percentage} | {yes/no} |

**Winner:** `{winner label}` — {one sentence why from notes or top criteria}

#### Excerpts

**{Winner label}** (first ~400 chars):

> {content excerpt}

**Runner-up** (optional):

> {excerpt}

#### Improved final answer

> {improvedAnswer.finalAnswer}

**Strengths:** {improvedAnswer.strengths}  
**Weaknesses:** {improvedAnswer.weaknesses}  
**Useful from others:** {improvedAnswer.usefulFromOthers}

#### Caveats

- Scores produced by LLM batch judge unless marked manual.
- Not a production safety certification.
- Provider/preset at run time: note from your env (`LLM_PRESET`, date).

---

## jq helpers

```bash
# Score table
jq -r '.answers[] | [.label, ([.scores[].points]|add), .isWinner] | @tsv' eval.json

# Winner only
jq -r '.answers[] | select(.isWinner) | .label' eval.json

# Prompt
jq -r '.prompt' eval.json
```

## Markdown export tips

- Truncate long answers with ellipsis; link to full JSON for auditors.
- Include criterion-level breakdown when stakeholders dispute a single dimension:

```bash
jq -r '.answers[] | .label as $l | .scores[] | [$l,.criterionId,.points] | @tsv' eval.json
```

## When to regenerate sections

| Section stale if… | Action |
|-------------------|--------|
| Scores | Prompt or criteria changed without re-score |
| Winner | Manual mark after report draft |
| Improved | Winner changed |

## Related skills

- `aieval-interpret-evaluation-results` — nuance and red flags
- `aieval-run-model-evaluation` — reproduce run
- `aieval-api-batch-runner` — fetch JSON
