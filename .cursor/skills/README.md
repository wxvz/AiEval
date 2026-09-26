# AiEval Cursor skills

Project skills for developing and using [AiEval](../../README.md). Invoke by name in Cursor (e.g. “use the aieval-automation-debug skill”).

## Catalog

| Skill | Audience |
|-------|----------|
| [aieval-automation-debug](aieval-automation-debug/SKILL.md) | Maintainer |
| [aieval-openrouter-free-tier](aieval-openrouter-free-tier/SKILL.md) | Both |
| [aieval-run-model-evaluation](aieval-run-model-evaluation/SKILL.md) | Practitioner |
| [aieval-rubric-design](aieval-rubric-design/SKILL.md) | Practitioner |
| [aieval-interpret-evaluation-results](aieval-interpret-evaluation-results/SKILL.md) | Practitioner |
| [aieval-prompt-variant-benchmark](aieval-prompt-variant-benchmark/SKILL.md) | Practitioner |
| [aieval-evaluation-report](aieval-evaluation-report/SKILL.md) | Practitioner |
| [aieval-prompts-and-judge](aieval-prompts-and-judge/SKILL.md) | Maintainer |
| [aieval-resilient-llm](aieval-resilient-llm/SKILL.md) | Maintainer |
| [aieval-automation-testing](aieval-automation-testing/SKILL.md) | Maintainer |
| [aieval-add-llm-provider](aieval-add-llm-provider/SKILL.md) | Maintainer |
| [aieval-api-batch-runner](aieval-api-batch-runner/SKILL.md) | Practitioner / CI |
| [aieval-model-preset-regression](aieval-model-preset-regression/SKILL.md) | Maintainer |
| [aieval-nn-core](aieval-nn-core/SKILL.md) | Maintainer |
| [aieval-nn-playground](aieval-nn-playground/SKILL.md) | Maintainer |
| [aieval-learn-hub](aieval-learn-hub/SKILL.md) | Maintainer |
| [aieval-keep-tests-current](aieval-keep-tests-current/SKILL.md) | Maintainer — CI via `.github/workflows/ci.yml` → `npm run ci` |

## Personal vs repo

These skills contain **no API keys or private benchmark prompts**. Keep them in `.cursor/skills/` for the team.

If you fork a skill to embed **private golden prompts** or org-specific keys, copy it to `~/.cursor/skills/` instead — never commit secrets.

## Authoring

Follow Cursor’s [create-skill](https://cursor.com) conventions: YAML frontmatter with `name` and `description`, third-person description with WHAT + WHEN triggers.
