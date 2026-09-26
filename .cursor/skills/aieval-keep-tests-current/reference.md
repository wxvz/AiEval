# AiEval test file map

Last aligned with repo layout: CI via `.github/workflows/ci.yml` → `npm run ci` (builds + server Vitest + frontend `ng test --no-watch`). Scoped frontend: `npm test`; scoped server: `npx vitest run server/src`.

## Frontend (`src/**/*.spec.ts`)

| File | Covers |
|------|--------|
| `app.spec.ts` | Root `App` shell, navbar, router outlet |
| `guards/leave-during-automation-prompt.spec.ts` | Navigation guard during automation |
| `models/automation.model.spec.ts` | `automationProgressLabel` formatting |
| `services/evaluation.service.spec.ts` | CRUD, criteria modes, HTTP API |
| `services/evaluation.service.automate.spec.ts` | Automation SSE / phase client |
| `services/feedback.service.spec.ts` | Toast timing, dismiss |
| `services/http-error-message.spec.ts` | Error string mapping |
| `services/server-settings.service.spec.ts` | Server settings fetch |
| `services/settings.service.spec.ts` | Local settings persistence |
| `services/theme.service.spec.ts` | Theme toggle |
| `utils/automation-page-context.spec.ts` | Page context helpers |
| `utils/format-token-usage.spec.ts` | Token display formatting |
| `utils/group-evaluations-by-day.spec.ts` | Dashboard grouping |
| `utils/model-leaderboard.spec.ts` | Leaderboard aggregation |
| `utils/paginate.spec.ts` | Pagination slice / clamp |
| `utils/settings-status.spec.ts` | Provider status display |
| `utils/nn/network.spec.ts` | XOR / sigmoid vs linear golden training |
| `utils/nn/dataset-validation.spec.ts` | Custom row parsing and warnings |
| `components/automation-controls/automation-controls.spec.ts` | `canRunAutomationPhase` |
| `components/automation-controls/automation-controls.dismiss.spec.ts` | Dismiss / cancel UX |
| `components/automation-controls/automation-controls.provider-preference.spec.ts` | Local vs cloud preference |
| `components/confirm-delete-modal/confirm-delete-modal.spec.ts` | Delete modal |
| `components/provider-choice-modal/provider-choice-modal.spec.ts` | Provider picker |
| `components/settings-aside/settings-aside.spec.ts` | Settings aside |
| `pages/create-evaluation-page/create-evaluation-page.spec.ts` | Create flow, automation metadata |
| `pages/compare-answers-page/compare-answers-page.spec.ts` | Compare page |
| `pages/edit-evaluation-page/edit-evaluation-page.spec.ts` | Edit evaluation |

**Gap watch**: new pages/components under `src/app/` without a matching `.spec.ts` — add one when behavior is non-trivial.

## Server (`server/**/*.test.ts`)

| Area | Files |
|------|-------|
| Automation | `automation/constants.test.ts`, `metadata.test.ts`, `provider-choice.test.ts`, `resilient-automation.test.ts`, `resilient-llm.test.ts`, `run-evaluation-phases.test.ts`, `run-registry.test.ts`, `rubric-anchors.test.ts`, `scores.test.ts` |
| LLM | `llm/chat.test.ts`, `generate-prompt.test.ts`, `generate-title.test.ts`, `groq-fallback.test.ts`, `llm-http-error.test.ts`, `model-presets.test.ts`, `openrouter.test.ts`, `parse-json.test.ts`, `parse-usage.test.ts`, `prompts.test.ts`, `provider.test.ts`, `sanitize-model-output.test.ts`, `token-accumulator.test.ts`, `types.test.ts` |
| Routes | `routes/settings.test.ts`, `routes/status.test.ts` |
| Infra | `config.test.ts`, `serialization.test.ts`, `format/json-to-sentences.test.ts`, `logging/format-log-line.test.ts`, `logging/logger.test.ts`, `middleware/request-logger.test.ts`, `startup/preflight.test.ts` |

## Quick grep commands

```bash
# Find specs referencing a symbol
grep -r "canRunAutomationPhase" src --include="*.spec.ts"
grep -r "prepareDocForPhase" server --include="*.test.ts"

# List frontend tests ng discovers
npm test -- --list-tests

# Count server test files
find server -name '*.test.ts' | wc -l
```
