---
name: aieval-add-llm-provider
description: >-
  Checklist for adding a new LLM provider to AiEval following PROVIDER_ORDER,
  adapter patterns, model presets, and status probes. Use when integrating a new
  API key provider, adapter file, or model preset entries.
---

# Add an LLM provider (maintainer)

## Checklist

1. **Types** — Add name to `ProviderName` in `server/src/llm/types.ts`.
2. **Adapter** — Create `server/src/llm/<provider>.ts`:
   - `create<Provider>Provider(): LlmProvider` with `complete(messages, options)`
   - `has<Provider>Credentials()` reading env from `server/src/config.ts`
   - Use `llmFetch`, `throwLlmHttpError`, `parseOpenAiCompatibleUsage` where applicable (see `groq.ts`, `openrouter.ts`).
3. **Wire factory** — `createLlmProvider` switch in `server/src/llm/provider.ts`.
4. **Order** — Insert into `PROVIDER_ORDER` (local `ollama` usually stays first).
5. **Availability** — `isProviderAvailable` branch for credentials/health.
6. **Resolve** — `tryResolve` already loops `PROVIDER_ORDER`; ensure `tryResolve('<name>')` works.
7. **Model presets** — `server/src/llm/model-presets.ts`: answer slots (3) + judge for `balanced` and `fast`.
8. **Env** — Document in `.env.example` (no real keys).
9. **Status** — `probeProvider` in `provider.ts` exposes models on `GET /api/status`.
10. **Fallback mapping** — `resolveProviderModelForCall` / `groq-fallback.ts` if cross-provider model IDs differ.
11. **Test** — Unit test for credential guard; manual `npm run dev` + Settings aside probe.

## PROVIDER_ORDER (current)

```
ollama → groq → openrouter → gemini → huggingface
```

Fallback in `resilient-llm.ts` walks **later** entries in this list.

## Adapter contract (`LlmProvider`)

```typescript
interface LlmProvider {
  name: ProviderName;
  complete(messages: ChatMessage[], options?: LlmCompleteOptions): Promise<LlmCompletion>;
}
```

Support `options.json: true` for judge/improved calls (`response_format` where API allows).

Return `usage` when the API provides token counts; otherwise callers estimate.

## Model presets

`resolveModelsForProvider(provider, preset)` returns:

- `answerModels`: three `{ model, label }` entries
- `judgeModel`: one judge reference

Override via env:

- `LLM_ANSWER_MODELS=provider:model,...`
- `LLM_JUDGE_MODEL=provider:model`

## Startup preflight

`server/src/startup/preflight.ts` logs provider readiness when `STARTUP_PREFLIGHT=true`.

## Do not

- Hardcode API keys in repo or skills.
- Skip `isProviderAvailable` — breaks fallback chain assumptions.
- Forget OpenRouter-specific headers if cloning that pattern (`OPENROUTER_HTTP_REFERER`, etc.).

## Related skills

- `aieval-resilient-llm` — fallback uses new provider automatically once in `PROVIDER_ORDER`
- `aieval-model-preset-regression` — validate presets after adding models
