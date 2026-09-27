---
name: aieval-run-model-evaluation
description: >-
  Guides running AiEval model comparisons via the UI or API: create evaluations,
  run automation phases, interpret winners and scores. Use when comparing LLM
  answers, picking a winner, evaluating a prompt, or asking which model is better.
---

# Run a model evaluation in AiEval

## What you get

One **evaluation** = one user **prompt** + **rubric** + **N model answers** (typically 3) + **scores** + **winner** + optional **improved final answer**.

## UI workflow

### Fast path (full automation)

1. Dashboard → **New Evaluation**.
2. Leave title/prompt empty **or** fill both (not only one).
3. **Run full automation** — metadata (if empty) → 3 answers → auto-score → winner → improved draft.
4. Open **Compare** / **Edit** from completion links.

### Step-by-step (recommended under rate limits)

| Step | Page | Action |
|------|------|--------|
| 1 | **New** or **Edit** | Set title, prompt, criteria mode |
| 2 | **Edit** | **Generate answers** |
| 3 | **Compare** | **Auto-score answers** (picks winner) |
| 4 | **Improved** | **Generate improved answer** |

Between steps 2 and 3, wait a few minutes if using OpenRouter free tier (`aieval-openrouter-free-tier` skill).

### Manual path

1. **Edit** — add answers by hand (model label + content).
2. **Compare** — enter scores per criterion; **Mark winner**.
3. **Improved** — write or generate improved sections.

## Criteria mode

| Mode | When to use |
|------|-------------|
| **Default** | General Q&A; five built-in criteria (Accuracy, Clarity, Completeness, Relevance, Safety) with 1–5 anchors |
| **Custom** | Domain tasks (coding, RAG, safety policies) — design rows with `aieval-rubric-design` skill |

Custom mode needs **≥1 criterion** before generate/score automation runs.

## Reading results

| Output | Meaning |
|--------|---------|
| Per-criterion **points** / **maxPoints** | Rubric scores for that answer |
| **Total / %** on Compare | Sum across criteria; higher usually wins |
| **Winner** chip | `winnerAnswerId` / `isWinner` |
| **`automatedAt`** | AI last completed scoring (banner on Compare) |
| **`improvedAnswer.finalAnswer`** | Synthesized best response to the original prompt |
| **`tokenUsage`** | Cumulative tokens (estimated if provider omits usage) |

Automation does not replace human review for high-stakes decisions — use scores as signal, not ground truth.

## Rate-limit hygiene

- Prefer **phased** runs over repeated **full** automation.
- After failed score with saved answers, use **Auto-score** only (not full re-run).
- See `aieval-openrouter-free-tier` for OpenRouter-specific guidance.

## API (headless / scripts)

Base URL: `http://localhost:3000` (dev API). See `aieval-api-batch-runner` for full SSE scripting.

```bash
# Create evaluation
curl -s -X POST http://localhost:3000/api/evaluations \
  -H 'Content-Type: application/json' \
  -d '{"title":"My eval","prompt":"Explain trade-offs of X in 3 bullets.","criteriaMode":"default"}'

# Full automation (SSE) — replace ID
curl -N "http://localhost:3000/api/evaluations/<id>/automate/stream?phase=full"

# Single phase
curl -N "http://localhost:3000/api/evaluations/<id>/automate/stream?phase=generate"
curl -N "http://localhost:3000/api/evaluations/<id>/automate/stream?phase=score"
curl -N "http://localhost:3000/api/evaluations/<id>/automate/stream?phase=improved"

# Force replace existing work
curl -N "http://localhost:3000/api/evaluations/<id>/automate/stream?phase=score&force=true"
```

Cancel: `POST /api/evaluations/:id/automate/cancel` with body `{ "runId": "<from SSE status event>" }`.

## Providers and presets

- Providers tried in order: Ollama → Groq → OpenRouter → Gemini → Hugging Face (first available wins).
- **Settings → Models**: `balanced` (small answers + stronger judge) vs `fast` (all small).
- At least one provider must be configured in `.env` (see `.env.example`).

## Related skills

| Skill | Use when |
|-------|----------|
| `aieval-rubric-design` | Designing custom criteria |
| `aieval-interpret-evaluation-results` | Explaining or challenging scores |
| `aieval-automation-debug` | Run failed or stuck |
| `aieval-evaluation-report` | Stakeholder write-up |
