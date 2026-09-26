---
name: aieval-learn-hub
description: >-
  Guides AiEval's Learn curriculum hub at /learn: curriculum metadata, JSON
  content files, progress, tracks, lesson/lab routes and learner prose style
  (no em dashes or hitching ", and"). Use when adding lessons, editing
  learn-page, curriculum.ts, or content/*.json.
---

# Learn hub (maintainer)

Curriculum shell: metadata in TypeScript, teachable text in JSON, pages render only.

## Routes

| Path | Component |
|------|-----------|
| `/learn` | `LearnPage` — roadmap + tracks |
| `/learn/lessons/:lessonId` | `LearnLessonPage` — read lessons |
| `/learn/labs/neural-network` | `NnPlaygroundPage` — foundation lab |
| `/learn/labs/semantic-search` | `SemanticSearchLabPage` — retrieval + cosine similarity |
| `/learn/labs/semantic-memory` | `SemanticMemoryLabPage` — optional ranking practice from read lesson |
| `/learn/labs/rag-playground` | `RagPlaygroundPage` — retrieve, assemble context, stub answer |
| `/learn/labs/first-evaluation` | `LearnWalkthroughPage` — AiEval warm-up walkthrough |
| `/learn/labs/support-bot-decision` | `LearnWalkthroughPage` — harness decision walkthrough (`data.lessonId`) |
| `/learn/neural-network` | redirect → `/learn/labs/neural-network` |

Tracks: `foundation`, `llm-systems`, `systems-production`. Each track's first live lesson has empty `prerequisites` so learners can start any track without finishing Foundation. Continue still walks global live order. Transformers (+ optional lab) lives in LLM systems after `automation-and-judges`; production/harness lessons live in Systems & production.

## Learn → AiEval handoff

| File | Role |
|------|------|
| `src/app/learn/learn-handoff.service.ts` | Per-lesson `sessionStorage` map (`byLesson` + `activeLessonId`) for banner/highlight/back-links |
| `src/app/learn/content/*-lab.json` (tool) | Walkthrough `steps` + `handoffCopy`; create/dashboard links include `learnLesson` |
| `src/app/learn/walkthrough-content.ts` | Loads steps by lesson id; unknown ids return empty steps (no silent first-eval fallback) |

Flow:

1. Walkthrough step links to `/evaluations/new?from=learn&learnLesson=<tool-lesson-id>` (live `queryParamMap`, not snapshot-only).
2. Create page shows that lab's hint only when both `from=learn` and a valid tool `learnLesson` are present; records handoff only when automation **finishes** with `automatedAt` via `recordEvaluation(id, lessonId)` (manual create / cancelled status do not unlock).
3. Dashboard activates the lab from `learnLesson`, highlights that evaluation, and `openCompare=1` navigates to Compare for **that lab's** handoff (`evaluationIdForLesson`), not another lab's active highlight. If `learnLesson` has no stored handoff, hide Learn banner/highlight (do not fall back to another lab's active entry).
4. Edit/compare **Back to Learn lab** uses `lessonIdForEvaluation(evalId)` so a second lab does not clobber the first lab's back-link.
5. Mark walkthrough complete requires a handoff whose evaluation has `automatedAt`; completing clears that lesson's handoff entry.

Query params: `from=learn` (`LEARN_FROM_QUERY`), `learnLesson` (`LEARN_LESSON_QUERY`), optional dashboard `openCompare=1`.

## File map

| File | Role |
|------|------|
| `src/app/learn/curriculum.ts` | Track/lesson metadata, `getNextLesson`, validation |
| `src/app/learn/learn-content.ts` | JSON loaders, `HUB_COPY` |
| `src/app/learn/content/*.json` | Lesson bodies, walkthrough steps, hub copy |
| `src/app/learn/learn-progress.service.ts` | `localStorage` completion |
| `src/app/learn/learn-handoff.service.ts` | Lab evaluation handoff (`sessionStorage`) |
| `src/app/pages/learn-page/` | Hub |
| `src/app/components/page-shell/` | Shared full-width three-column shell; Learn pages consume its left/main/right slots |
| `src/app/pages/learn-lesson-page/` | Read lesson shell: lesson rail + lesson body + sticky aside |
| `src/app/components/learn-lesson-rail/` | Read lesson left rail: back link, metadata, hint, Sections TOC, Key terms |
| `src/app/components/learn-lesson-aside/` | Read lesson right rail: progress, optional lab, AiEval tip, nav |
| `src/app/components/learn-lab-nav/` | Shared sticky lab/walkthrough completion and parent-aware prev/next navigation |
| `src/app/components/learn-locked-callout/` | Reusable locked-state callout for lab pages |
| `src/app/components/learn-lab-link/` | Lock-aware curriculum link (redirects locked targets to missing prereq) |
| `src/app/learn/learn-lab-lock.ts` | Shared lock helpers + `resolveLearnSafeLink` |
| `src/app/components/learn-check-question/` | Interactive check-yourself UI |
| `src/app/learn/check-answer.ts` | Answer normalization + matching |
| `src/app/pages/learn-walkthrough-page/` | Tool walkthrough shell |
| `src/app/utils/retrieval/` | Client-only retrieval engine (corpus, similarity, context, stub generate) |
| `src/app/pages/semantic-search-lab/` | Semantic search interactive lab |
| `src/app/pages/semantic-memory-lab/` | Optional semantic memory practice mini-lab |
| `src/app/pages/rag-playground/` | RAG playground interactive lab |
| `src/app/services/settings.service.ts` | `learnUnlockAll` — bypass read-lesson prerequisite locks |
| `src/styles.css` | Shared `.learn-lab-faq`, `.learn-lab-diagram`, `.learn-back-link` for lab pages |

## Prerequisites and unlock

Read lessons (`kind: 'read'`), interactive labs and tool walkthroughs are **locked** on the hub until every id in `prerequisites` is in `LearnProgressService` completion storage. Direct lab URLs still load for teaching, but the hub and lesson page gate entry the same way.

| Function | Role |
|----------|------|
| `prerequisitesMet()` | All prerequisite ids completed |
| `isLessonLocked(lesson, completedIds, { ignorePrerequisites? })` | Lock check; pass `ignorePrerequisites: true` to bypass |

**Settings → Learn → Unlock all lessons** (`SettingsService.learnUnlockAll`, key `aieval-settings-learn-unlock-all`):

- Hub cards (`learn-track-list` `lessonRows` computed) and lesson page (`learn-lesson-page` `locked` computed) react to the toggle.
- Roadmap **Continue →** still follows curriculum order via `getNextLesson` — unlock does not change progress tracking.

## Interactive lab page shell

All labs share the NN lab teaching shell (not read-lesson `app-learn-check-question` gating):

1. Lead + prereq bridge link (`prereqMeta` from `curriculum.ts`)
2. Honesty callout (teaching shortcut vs production)
3. Starting tip
4. Interactive controls + optional diagram (keep existing SVGs; add pipeline/flow where helpful)
5. Review / Next cross-links above **Common questions**
6. `<details class="learn-lab-faq">` FAQ block (styles in `styles.css`)
7. Sticky right navigation — back, **Mark lab complete**, and curriculum-aware previous/next links

Reference: `src/app/pages/nn-playground/nn-playground.html`.

## Add an interactive lab

1. Add `LearnLessonMeta` row (`kind: 'interactive'`, `contentFile: null`) in `curriculum.ts`.
2. Put teaching logic in `src/app/utils/<engine>/` with unit tests.
3. Add page under `src/app/pages/<lab-name>/` wiring `LearnProgressService.markComplete`.
4. Register route in `app.routes.ts`.
5. Run `npm test -- --include='src/app/learn/curriculum.spec.ts'` and engine specs.

## Add a read lesson

1. Add `LearnLessonMeta` row to `LEARN_LESSONS` in `curriculum.ts` (id, track, order, route, prerequisites).
2. Create `src/app/learn/content/{id}.json` with `sections` and `checkQuestions`.
3. Import JSON in `learn-content.ts` and register in `LESSON_CONTENT`.
4. Run `npm test -- src/app/learn/curriculum.spec.ts`.

### Check-yourself questions

Each question (section `check` or `recapQuestions` entry):

```json
{
  "prompt": "Question shown in the prompt card",
  "answer": "Canonical reference shown after a wrong check",
  "accept": ["optional", "alternate correct phrasings"],
  "choices": ["optional", "multiple", "choice", "options"],
  "explanation": "Required: 2-4 sentences shown after correct (section reopen or recap solve)"
}
```

**Section checks** live on each `LessonSection` as `check` (one per section). **Recap** uses `recapQuestions` (2 items) at the lesson bottom.

**UX:** After a correct section check, the section collapses to a header; reopening shows **Why this answer** (`explanation`). Wrong answers show the canonical answer card and keep the section expanded for retry. Mark complete is gated until all section checks and recap questions are solved (`LearnLessonSessionService`).

When `choices` is present (2–4 items), the UI renders radio buttons. Component: `app-learn-check-question`. Section shell: `app-learn-lesson-section`.

### Glossary term hints

Wrap glossary keys in lesson JSON with `{{termKey}}` (camelCase id from `src/app/learn/learn-glossary.ts`). Rendered in paragraphs, bullets, reveals, and check prompts via `app-learn-lesson-text` — dotted underline, click for popover (same UX as the neural network lab).

Do not glue suffixes to markers (`{{input}}s`, `{{model}}'s`) — write natural prose (`inputs`, `the {{model}}'s weights` as separate words) so spacing stays correct.

```json
"paragraphs": [
  "A {{model}} maps each {{input}} to a {{prediction}}; training nudges it toward the {{target}}."
]
```

Add new terms to `learn-glossary.ts` before using them in JSON. Do not assume learners know jargon — mark the first meaningful use of each term in a lesson.

### Section asides (sidebar AiEval tips)

Optional per-section `aside` renders in the sticky sidebar (`app-learn-lesson-aside`) for the **active section** (first unsolved section, or last when all solved). Hidden when the lesson is locked.

```json
"aside": {
  "title": "Try in AiEval",
  "body": "Create an evaluation with one clear {{prompt}} and two {{model}}s.",
  "route": "/evaluations/new?from=learn",
  "actionLabel": "New evaluation"
}
```

- `title` and `body` required when `aside` is present; `body` supports `{{termKey}}` markers.
- `route` optional; default CTA label is **Open in AiEval** when `actionLabel` is omitted.

### Read lesson layout

- All Learn routes use `app-page-shell`, a full-width three-column layout.
- Read lesson left rail: Learn back link, track, title, summary, term-hint guidance, numbered Sections TOC (active section highlighted), and Key terms below that content.
- Read lesson middle: numbered section cards, Check yourself prompts, and Recap. Mark complete lives in the right aside.
- Read lesson right rail: section progress bar, optional lab, **branch practice links** (`getDirectBranchLessons`), active AiEval tip, Mark complete, and lesson navigation.
- Hub: left track index (icons + frac, active left border), carded roadmap progress (no Continue), numbered lesson row lists with compact click-to-expand details (summary when unlocked; unlock line when locked; title navigates; Locked/Coming soon always visible), sticky Continue/Dashboard on the right (solid Continue); **More** keeps New evaluation. Side **Branches** (`branch: true`) render as forked hub spurs under their spine parent **when that parent row is expanded**.
- Read lesson: left rail = back + track + title + numbered Sections TOC (active highlight) + Key terms below; main = numbered section cards + Check yourself; right aside = section progress bar, optional lab / branch practice, AiEval tip, Mark complete, prev/next.
- Shared chrome: `.learn-sticky-panel`, `.learn-eyebrow`, `.learn-status-chip`, `.learn-callout` in `styles.css`.
- Labs and walkthrough: empty left rail, existing teaching content in the middle, `app-learn-lab-nav` on the right.
- Optional/branch lessons resolve back via `parentLessonId` and Continue prev/next via `getNavigableAdjacent` (walks to spine parent). Do not call `getAdjacentLessons()` on an optional id and accept empty navigation.
- Mobile: shell columns stack; empty rails collapse and populated navigation remains available after the main content.
- Practice labs and demoted spine labs: `optional: true` + `branch: true` + `parentLessonId` in `curriculum.ts`; hub spur via `getBranchSpurForLesson`; lesson-page aside via `getDirectBranchLessons` (excluded from `getOptionalLabForLesson` and Continue `LIVE_LESSON_ORDER`). **Direct children only:** nested branch labs (e.g. Decision trees lab under the Decision trees read lesson) appear on that branch lesson's aside, not on the spine parent. Same one-level depth as hub spur expansion.
- Branch aside CTAs use `resolveLearnSafeLink`. When the only missing prereq is the **current** read lesson, show a disabled **Mark this lesson complete first** button instead of linking back to the same page.
- Branches: same flags; nested spurs follow `parentLessonId` (e.g. Search → RAG, First eval → Support bot).
- Continue rewires: embeddings after softmax; faithfulness after semantic-memory; regression after outside-eval-practice (labs no longer gate the spine).

## Lesson authoring criteria

Use this checklist before marking a read lesson `status: 'live'` or before requesting content from an agent. Interactive labs and tool walkthroughs have parallel rules below.

### Read lesson — structure (required)

| Rule | Target |
|------|--------|
| Sections | **3** per lesson (concept → practice/scenario → bridge forward) |
| Paragraphs | **4–5** per section before the section check; plain language |
| Section check | **1** per section (`section.check`) with required `explanation` |
| Recap | **2** questions in `recapQuestions` synthesizing the lesson |
| Bullets / reveals | At least **1 section** with `bullets` or **2–4** `reveals` |
| Reading time | **~10–15 minutes** including checks and recap |

### Read lesson — pedagogy (required)

1. **One idea** — lesson title = single takeaway; do not cover the whole track.
2. **Analogy first** — open section 1 with a concrete metaphor (flash cards, open-book exam, etc.).
3. **AiEval-relevant example** — at least one scenario about prompts, eval, labels, or model comparison (not only cats-and-dogs unless bridging to the lab).
4. **Bridge forward** — last section names the **next lesson or lab** by title and why it follows.
5. **Honest shortcuts** — if the lab does something simplified (e.g. no test split in NN lab), say so explicitly.
6. **Vocabulary** — wrap terms in `{{termKey}}` markers; definitions live in `learn-glossary.ts` (learners tap to read — never assume prior knowledge).

### Read lesson — prose style (required)

Learner-facing Learn copy must read smoothly. Apply to lesson JSON (`content/*.json`), `curriculum.ts` summaries, glossary definitions used in lessons, walkthrough steps and lab/playground teaching strings.

| Do not use | Prefer |
|------------|--------|
| Em dash `—` or punctuation en dash `–` | Period, colon, comma or parentheses. Ranges/compounds use ASCII hyphen (`1-5`, `input-target`) |
| Hitching Oxford join `A, B, and C` / `A, B, or C` | `A, B and C` / `A, B or C` |
| Hitching short join `X, and Y` / `X, or Y` | `X and Y` / `X or Y` |
| Two full ideas jammed with `, and` | Two sentences (period split) |
| Trailing aside `, which …` | New sentence (`That` / `It` / `This`) or a tighter main clause |
| Filler openers `That is,` / `In other words,` / `Notice that` / `Notice how` | State the point directly |

**Keep** genuine intro commas (`If …,` / `When …,` / `For …,`) and sharp contrast `, but` when the contrast carries meaning.

**Examples**

```text
Bad:  Each example has two parts — an input and a target.
Good: Each example has two parts: an input and a target.

Bad:  Accurate, polite, and under 100 words
Good: Accurate, polite and under 100 words

Bad:  It covers how rows form a dataset, and why the lab offers XOR.
Good: It covers how rows form a dataset and why the lab offers XOR.
# or split: …form a dataset. The lab offers XOR to show…

Bad:  Notice that vague prompts allow creativity.
Good: Vague prompts allow creativity.
```

Before shipping, verify with ripgrep (expect no learner-facing hits):

```bash
rg '[—–]' src/app/learn/content src/app/learn/curriculum.ts src/app/learn/learn-glossary.ts
rg ', and |, or ' src/app/learn/content
rg 'Notice that|Notice how|That is,|In other words' src/app/learn/content
```

### Check-yourself — question design (required)

| Do | Don't |
|----|-------|
| Scenario + decision (“Your team downloads…”) | Restate the section heading as the question |
| Plausible wrong MC options (common mistakes) | Joke options or “all of the above” |
| Free-text asks for a **short phrase** (2–6 words) | Require essay-length or exact punctuation |
| `accept` lists **3–5** normalized aliases | Single brittle string with no aliases |
| MC `answer` matches one `choices` entry exactly | Correct answer only in `answer`, not in `choices` |

Question progression within a lesson:

1. **Spot the trap** — spot the common mistake (unlabeled data, training on test, etc.).
2. **Apply** — pick the right approach for a realistic task.
3. **Summarize** — one phrase capturing the core concept.

### Metadata alignment (required)

`curriculum.ts` `summary` must match what the lesson actually teaches. Prerequisites must reference lesson ids the learner has completed. If the lesson introduces vocabulary for a lab, that lab must come **after** it in the track order.

### Interactive lab — criteria

| Rule | Target |
|------|--------|
| Intro | 2–3 sentences + link back to prerequisite read lessons |
| Glossary | Term hints for jargon used on the page |
| Goal | At least one suggested starting task (“solve XOR first”) |
| Honesty | Call out teaching shortcuts vs production practice |
| Progress | `LearnProgressService.markComplete` wired; lab id in `curriculum.ts` |

Do **not** build new lesson-only widgets unless the JSON schema cannot express the interaction (prefer `reveals` + MC for read lessons).

### Tool walkthrough — criteria

| Rule | Target |
|------|--------|
| Steps | **4–6** ordered steps with `actionRoute` into real AiEval pages |
| Handoff | `?from=learn&learnLesson=<id>` on create/dashboard links; Compare via `openCompare=1`; `handoffCopy` for banner text |
| Completion | Gate mark-complete on `hasHandoffForLesson(id)` (plus steps); clear that lesson handoff on complete |

### Authoring workflow

```
1. Read curriculum.ts row (title, summary, prerequisites, next lesson/lab).
2. Draft outline: 3 section titles + 3 question prompts (before prose).
3. Write JSON using schema in learn-content.ts.
4. Self-check against structure, pedagogy and prose-style tables above.
5. Register in learn-content.ts; run curriculum.spec.ts.
6. Smoke-test in browser: reveals open, MC checks, mark complete enables.
```
### Ready-to-ship checklist

Copy per lesson:

```
- [ ] 3 sections with 4-5 paragraphs each + section.check with explanation
- [ ] 2 recapQuestions with explanations
- [ ] Bridges to next lesson/lab by name
- [ ] summary in curriculum.ts still accurate
- [ ] Prose style: no em/en dashes; no hitching ", and"/", or"; no Notice that / That is, fillers
- [ ] validateLessonContent() passes
- [ ] Browser smoke-test: collapse on correct, reopen shows Why this answer
```

### Anti-patterns (do not ship)

- Empty `sections: []` on a `live` read lesson
- Check questions answerable without reading the lesson
- Free-text `answer` identical to words in the `prompt`
- More than one major concept per lesson (split into two curriculum rows instead)
- Systems & production lessons that repeat Foundation content verbatim
- Em dashes `—`, punctuation en dashes `–` or hitching `, and` / `, or` in learner-facing Learn copy
- Filler openers (`Notice that`, `Notice how`, `That is,`, `In other words,`) that pad instead of teaching

## Add walkthrough steps

Edit `src/app/learn/content/first-evaluation-lab.json` — `steps` array with `actionRoute` pointing at AiEval pages (use `?from=learn` on create/dashboard links). Optional `handoffCopy` supplies create-page and dashboard banner text.

## Progress rules

- Read lessons: **Mark complete** only when `sections.length > 0`.
- Interactive labs without a solve check (`neural-network-lab`, `semantic-search-lab`, `rag-playground-lab`, …): markable when unlocked.
- Labs with an explicit solve/success check (`learning-rate-lab`, `softmax-and-distributions-lab`, bias/activation/trees/RL/multimodal/transformers, `what-is-a-dataset-lab`, `learning-from-examples-lab`, …): gate Mark complete with `[completionDisabled]="!solved()"` (or equivalent) and early-return in `markLabComplete`.
- Locked labs: wrap interactive content in `<app-learn-locked-callout [lesson]="labMeta">…</app-learn-locked-callout>`; callout shows prerequisite hint and `.learn-lab-body--locked` disables pointer events until unlocked.
- Cross-lab / curriculum links: use `<app-learn-lab-link route="/learn/labs/…">` (or `resolveLearnSafeLink`) so locked targets redirect to the first missing prerequisite instead of dumping the learner on a gated page. On read-lesson aside branch/optional CTAs, when the safe link resolves to the current lesson route, render a disabled **Mark this lesson complete first** button (pass `currentLessonRoute` into `LearnLessonAside`).
- Aside CTAs: `aside.route` may include `?query`; `LearnLessonAside` and walkthrough steps must pass path + `[queryParams]` via `learn-route.ts` helpers, never the raw string to `[routerLink]`. Tip asides may use `from=learn` without `learnLesson`; only tool handoffs need `learnLesson=<tool-id>`.

- Tool walkthroughs: markable when `walkthroughHasSteps(id)` and `hasHandoffForLesson(id)`.
- Unknown ids in `localStorage` are ignored on read.

## Testing

Scoped (after content or curriculum changes):

```bash
npm test -- --include='src/app/learn/**/*.spec.ts'
```

Before merge: `npm run ci` (see `aieval-keep-tests-current`).

## Related skills

- `aieval-nn-playground` — neural network lab page
- `aieval-nn-core` — engine under the lab
