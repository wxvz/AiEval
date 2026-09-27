---
name: aieval-skill-maintenance
description: Audits and updates project skills to keep paths, commands, references, and trigger descriptions current and efficient. Use when skills drift, paths break, commands become stale, or the user asks to refresh/maintain .cursor/skills content.
disable-model-invocation: true
---

# AiEval Skill Maintenance

## Goal

Keep project skills in `.cursor/skills/` accurate, concise, and runnable.

## Maintenance Workflow

Copy this checklist and update status while working:

```text
Skill Maintenance Progress
- [ ] 1) Inventory skills and linked files
- [ ] 2) Audit stale paths and commands
- [ ] 3) Audit metadata and trigger quality
- [ ] 4) Apply targeted fixes
- [ ] 5) Re-verify links/commands
- [ ] 6) Summarize changes and residual risks
```

## 1) Inventory

1. List skill folders under `.cursor/skills/`.
2. For each skill, read `SKILL.md`.
3. Note linked files (`reference.md`, `examples.md`, `scripts/*`).

## 2) Audit Staleness

Check each skill for:

- Broken relative links.
- Paths that no longer exist in repo.
- Commands that use outdated filenames/options.
- Mentions of deprecated workflows.
- Contradictions between steps and actual project structure.
- Test/CI commands out of sync with `.github/workflows/ci.yml` and the `ci` script in `package.json` — use `aieval-keep-tests-current` as the canonical test guide.

## 3) Audit Skill Quality

Verify each `SKILL.md`:

- Uses valid frontmatter:
  - `name`: lowercase letters/numbers/hyphens only.
  - `description`: specific WHAT + WHEN trigger terms.
- Keeps main body concise (prefer under 500 lines).
- Uses consistent terminology.
- Uses one-level reference links (no deep chaining).
- Provides default path/command choices instead of many alternatives.

## 4) Fix Rules

When editing:

1. Prefer minimal, targeted updates over rewrites.
2. Keep user-provided wording verbatim when explicitly requested.
3. Replace stale paths with current repo-relative paths.
4. Update command examples to the current toolchain.
5. Move verbose details to `reference.md` when needed.
6. Keep examples concrete and directly executable.

## 5) Re-Verification

After edits:

1. Re-open changed skill files.
2. Re-check every referenced link/path.
3. Re-run any listed validation command if present.
4. Confirm no accidental edits outside intended skill files.

## Output Format

Report maintenance in this structure:

```markdown
## Skill Maintenance Report

### Updated Skills
- `path/to/SKILL.md`: short summary of fix

### Path/Command Fixes
- old -> new

### Risks / Follow-ups
- Anything not fixed yet and why
```

## Scope Notes

- This skill is for maintenance of existing skills.
- Use `/create-skill` when authoring a brand-new skill from scratch.
