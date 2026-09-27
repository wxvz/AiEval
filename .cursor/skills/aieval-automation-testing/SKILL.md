---
name: aieval-automation-testing
description: >-
  Guides writing AiEval automation tests with vi.hoisted mocks, asserting SSE
  progress shapes and checkpoint behavior without real LLM calls. Use when adding
  or fixing automation tests under server/src/automation.
---

# Automation testing (maintainer)

## Rule: mock before import

Automation modules pull in `db`, `provider`, `chat`. Tests **must** register mocks with `vi.hoisted` **before** importing the module under test.

```typescript
const { updateOne, resolveProvider } = vi.hoisted(() => ({
  updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  resolveProvider: vi.fn(),
}));

vi.mock('../db.js', () => ({
  getEvaluationsCollection: () => ({ updateOne }),
}));
vi.mock('../llm/provider.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/provider.js')>();
  return { ...actual, resolveProvider };
});

import { prepareDocForPhase } from './run-evaluation.js';
```

See `run-evaluation-phases.test.ts` and `resilient-automation.test.ts` for canonical patterns.

## What to assert (and not)

| Assert | Avoid |
|--------|-------|
| `chat` / `chatJson` **call count** | Real LLM responses |
| Progress callback payloads (`type`, `slotIndex`) | Exact model output text |
| `updateOne` / checkpoint when partial generate | Full E2E against providers |
| `AutomationError` message + `step` | Flaky timing without fake timers |

## Test file map

| File | Style | Covers |
|------|-------|--------|
| `run-evaluation-phases.test.ts` | Unit | `prepareDocForPhase` guards, force clears, resume rules |
| `resilient-llm.test.ts` | Unit | Slots, `validateAnswersForScoring`, `callSingleModelWithFallback`, `isFallbackEligible` |
| `resilient-automation.test.ts` | Integration-style | Partial 429 → checkpoint → resume fills one slot |
| `scores.test.ts` | Pure | Judge JSON parse, anchors, `pickWinner`, tie helpers |
| `metadata.test.ts` | Mocked chain | Title → prompt order |
| `constants.test.ts` | Pure | Metadata stub detection |
| `provider-choice.test.ts` | In-memory | Wait/submit/supersede |
| `run-registry.test.ts` | In-memory | Cancel aborts choice |
| `rubric-anchors.test.ts` | Pure | Anchor formatting |

## Common mocks

```typescript
vi.mock('../llm/chat.js', () => ({
  chat: vi.fn(),
  chatJson: vi.fn(),
  createLlmCallContext: vi.fn(() => ({})),
}));

vi.mock('../automation/metadata.js', () => ({
  generateEvaluationMetadata: vi.fn(),
}));

vi.mock('./run-registry.js', () => ({
  registerAutomationRun: vi.fn(),
  cancelAutomationRun: vi.fn(),
}));
```

For provider-order tests, stub `isProviderAvailable` → `false` to keep fallback chain deterministic (`resilient-automation.test.ts`).

## Simulating rate limits

Throw or return errors matching `isRateLimitExhausted` / `isRateLimitError` so generate wave marks slot pending, not fail-fast.

## Running tests

From repo root (server Vitest — **not** `npm test`, which is frontend `ng test`):

```bash
npx vitest run server/src/automation
```

Single file:

```bash
npx vitest run server/src/automation/resilient-llm.test.ts
```

Before merge, run full CI: `npm run ci` (see `aieval-keep-tests-current`).

## Adding a new phase guard

1. Add case to `prepareDocForPhase` in `run-evaluation.ts`.
2. Extend `run-evaluation-phases.test.ts` with `baseDoc()` + `expect(() => ...).toThrow(AutomationError)`.
3. If UI precondition differs, mirror in `automation-controls.spec.ts` → `canRunAutomationPhase`.

## Related skills

- `aieval-resilient-llm` — behavior under test
- `aieval-prompts-and-judge` — `scores.test.ts` when changing judge JSON
