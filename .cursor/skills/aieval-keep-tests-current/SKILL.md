---
name: aieval-keep-tests-current
description: >-
  Keeps AiEval unit tests aligned with code changes — run npm run ci (matches
  .github/workflows/ci.yml), find co-located specs, update assertions, and mirror
  server/UI behavior. Use when tests fail, after refactors or new features,
  before merging, or when asked to update or add test coverage.
---

# Keep tests current (maintainer)

AiEval uses **two test runners** plus **build steps** in CI. Match the merge gate before calling a change done.

## CI parity (merge gate)

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main` and on pull requests:

```bash
npm ci
npm run ci
```

The `ci` script in `package.json` is the source of truth:

```bash
npm run build && npm run build:server && npx vitest run server/src && npm test -- --no-watch
```

**Local equivalent before merge:** run `npm run ci` from the repo root. It builds frontend + server, then runs server Vitest and frontend `ng test` (non-watch).

When CI fails, reproduce with `npm run ci` — do not guess at partial commands unless iterating on a scoped area.

## Test runners (what `npm run ci` executes)

| Step | Command | Scope |
|------|---------|-------|
| Frontend build | `npm run build` | Angular compile |
| Server build | `npm run build:server` | `tsc -p server/tsconfig.build.json` |
| Server tests | `npx vitest run server/src` | `server/**/*.test.ts` (32 files) |
| Frontend tests | `npm test -- --no-watch` | `src/**/*.spec.ts` (27 files) — Angular/jsdom |

For fast iteration, run scoped commands below; finish with `npm run ci`.

**Do not** treat `npm run test:server` as the full suite — it runs `src/**/*.spec.ts` through root Vitest **without** Angular setup and will fail (`describe is not defined`, `localStorage is not defined`, JIT errors).

## Workflow after code changes

Copy and track:

```
- [ ] Identify tests for touched modules (co-located + cross-layer table below)
- [ ] Update expectations when behavior changed intentionally
- [ ] Add cases for new branches, guards, validation, or error paths
- [ ] Run scoped tests for touched areas
- [ ] Run `npm run ci` (or both test commands + builds if CI script is broken)
- [ ] Fix failures — do not weaken assertions unless product intent changed
```

### 1. Find tests

| Pattern | Example |
|---------|---------|
| Co-located | `paginate.ts` → `paginate.spec.ts`, `scores.ts` → `scores.test.ts` |
| Grep symbol | search the changed export name in `*.spec.ts` / `*.test.ts` |
| Cross-layer | server automation guard ↔ `automation-controls.spec.ts` |

### 2. Decide: update vs add

| Change type | Action |
|-------------|--------|
| Bug fix | Add regression test if none exists; keep existing cases |
| Intentional behavior change | Update assertions and fixture data in co-located tests first |
| New pure function / guard | New `describe` block in co-located file |
| New automation phase or API route | Server test + frontend mirror where UI exposes the rule |
| Renamed export | Update imports in specs; grep for old name |

### 3. Run scoped tests

Frontend (glob relative to repo root):

```bash
npm test -- --include='src/app/utils/nn/**/*.spec.ts'
npm test -- --include='src/app/components/automation-controls/**/*.spec.ts'
npm test -- --filter='canRunAutomationPhase'
```

Server:

```bash
npx vitest run server/src/automation/resilient-llm.test.ts
npx vitest run server/src/llm/model-presets.test.ts
npx vitest run server/src/automation
```

## Cross-layer mirrors (easy to forget)

| Server | Frontend |
|--------|----------|
| `prepareDocForPhase` (`run-evaluation-phases.test.ts`) | `canRunAutomationPhase` (`automation-controls.spec.ts`) |
| `metadata.ts` / stub constants (`metadata.test.ts`, `constants.test.ts`) | `create-evaluation-page.spec.ts` automation metadata |
| `model-presets.ts` (`model-presets.test.ts`) | Settings / preset UI if labels or defaults change |
| `scores.ts` / judge JSON (`scores.test.ts`) | Compare page only if display logic changes — scoring rules stay server-side |
| Route handlers (`routes/*.test.ts`) | Matching `*.service.spec.ts` HTTP expectations |

Domain-specific mock patterns: `aieval-automation-testing` (automation), `aieval-nn-core` (NN golden tests).

## Frontend spec conventions

- **Runner**: always `npm test`, not root Vitest.
- **Pure logic** (no TestBed): may omit vitest imports — `ng test` provides globals. Files that import `describe`/`it`/`expect` from `'vitest'` also work.
- **TestBed / HTTP**: use `TestBed`, `provideHttpClientTesting`, `httpMock.verify()` in `afterEach` (see `evaluation.service.spec.ts`).
- **localStorage**: clear in `beforeEach` when testing settings persistence.
- **Timers**: `vi.useFakeTimers()` + `vi.useRealTimers()` in feedback tests.

## Server test conventions

- **Runner**: `npx vitest run server/src` or a file path under `server/`.
- **Mocks before import**: `vi.hoisted` + `vi.mock` before importing module under test (automation, routes, LLM). See `aieval-automation-testing`.
- **Pure logic**: no mocks — `scores.test.ts`, `constants.test.ts`, `rubric-anchors.test.ts`.
- **No real LLM calls**: mock `chat` / `chatJson`; assert call counts and error types, not model text.

## When tests fail

| Failure | Likely fix |
|---------|------------|
| CI red on PR, passes locally with scoped tests only | Run `npm run ci` — builds (`ng build`, `build:server`) catch compile errors tests miss |
| `describe is not defined` on `src/**` | Ran via `npm run test:server` — use `npm test` |
| `localStorage is not defined` | Same — need `ng test` jsdom environment |
| `@angular/compiler` / JIT | Angular spec run through wrong runner |
| Server mock not applied | Move `vi.mock` above import; use `vi.hoisted` |
| Flaky timing | Fake timers or avoid asserting wall-clock delays |
| Golden NN / XOR | Adjust epochs in spec, not tolerance — see `aieval-nn-core` |

## New feature checklist

- [ ] Co-located unit test file or new `describe` blocks
- [ ] Cross-layer mirror if server and UI share a rule
- [ ] Validation helpers tested as pure functions (no DOM)
- [ ] `npm run ci` passes (builds + both test runners)

## Test inventory

Full file → module map: [reference.md](reference.md).

## Related skills

- `aieval-automation-testing` — automation mocks and test file map
- `aieval-nn-core` — NN golden learning tests
- `aieval-model-preset-regression` — manual golden eval runs after preset changes
