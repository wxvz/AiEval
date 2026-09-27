---
name: aieval-openrouter-free-tier
description: >-
  Explains OpenRouter free-tier rate limits in AiEval, why batch judging fails
  after answer generation, and mitigations (phased runs, concurrency, presets).
  Use when OpenRouter returns 429 on scoring, openrouter/free is configured, or
  generate succeeds but score fails.
---

# OpenRouter free tier in AiEval

## Why judging fails first

OpenRouter free models (`openrouter/free`, `:free` suffixes) share **account-wide quota** across:

- Three parallel answer generations (`phase=generate` or first step of `full`)
- One **batch judge** call that sends **all answers + full rubric** in a single prompt
- Optional tie-break rank call
- Improved-answer synthesis

The judge request is **large** and often hits `429` immediately after three generate calls. This is expected upstream behavior, not an AiEval logic bug when only one provider is configured.

## Symptoms

| Where | What you see |
|-------|----------------|
| UI | Auto-score or full automation fails at scoring; generate may have succeeded |
| SSE | Progress stops after answers; `error` on scoring step |
| Logs | `llm.rate_limit`, `OpenRouter request failed: 429`, `step: scoring` |
| Later retries | Sometimes `404`, empty body, or `Unexpected end of JSON input` after 429 exhaustion |

## Mitigations (practitioner)

1. **Split phases** — Run **Generate answers** on Edit, wait **2–5 minutes**, then **Auto-score** on Compare.
2. **Do not spam full automation** — Each full run burns quota on generate + judge + improved.
3. **Settings** — Use **fast** preset when offered, or set `LLM_PRESET=fast` in `.env`.
4. **Concurrency** — Set `LLM_CONCURRENCY=1` in `.env` for `openrouter/free`.
5. **Delays** — Raise `LLM_INTER_CALL_DELAY_MS` to `1000`–`2000`.
6. **Retries** — Optionally increase `LLM_MAX_RETRIES` and `LLM_BACKOFF_BASE_MS`.
7. **Second provider** — Add `GROQ_API_KEY` or `GEMINI_API_KEY` so per-call fallback can switch provider for **only** the failed judge or answer slot.

## In-run recovery (maintainer context)

AiEval does not discard successful answers when the judge 429s:

- Answers are **checkpointed** to MongoDB after generate before scoring starts.
- SSE emits `step_paused` / `model_fallback` while retrying **only** the failed unit (slot or judge).
- **Resume generate**: evaluation with fewer than 3 answers and no winner → **Generate answers** without force fills missing slots only.

Do not treat "score failed, answers saved" as data loss.

## Model preset note

`server/src/llm/model-presets.ts` defaults for OpenRouter often use named `:free` answer models and a separate free judge (e.g. `meta-llama/llama-3.3-70b-instruct:free`). Overriding everything to `openrouter/free` increases shared-quota pressure.

Removing `LLM_ANSWER_MODELS` / `LLM_JUDGE_MODEL` overrides lets presets apply.

## Maintainer: when not to "fix" the app

If logs show 429 on scoring after successful generate with **only** `OPENROUTER_API_KEY` set:

- Document env mitigations above.
- Do not add infinite retries or bypass provider caps in code.
- Verify fallback chain tried fast preset and later providers (`isProviderAvailable`).

For general automation debugging, use the `aieval-automation-debug` skill.

## Env quick reference

```env
LLM_CONCURRENCY=1
LLM_INTER_CALL_DELAY_MS=1500
LLM_PRESET=fast
LLM_MAX_RETRIES=3
LLM_BACKOFF_BASE_MS=1000
```

Plus a second provider key when possible.
