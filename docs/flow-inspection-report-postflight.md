# Flow Inspection Report: Learn Curriculum Hub (Post-Implementation)

**Date:** 2026-07-07  
**Inspection Type:** Post-implementation (flow-inspector-post)  
**Flow Anchor:** `/learn` hub → lesson/lab routes → progress tracking → next lesson → AiEval tool integration  
**Implementation Status:** All core todos completed (curriculum-data, progress-service, lesson-routes, hub-ui, nn-lab-polish, frontend-tests)

---

## Executive Summary

**Verdict:** ✅ **APPROVED FOR HANDOFF** (0 critical, 1 warning, 4 info items)

The learn curriculum hub implementation successfully delivers a structured AI engineering curriculum shell with proper separation between metadata (curriculum.ts), content (JSON files), and rendering (page components). The learner journey from hub → lesson/lab → progress → next flows correctly with appropriate guards and validations.

**Key strengths:**
- Clean separation of concerns: metadata vs content vs presentation
- Robust progress tracking with stale ID filtering
- Proper prerequisite checking and locked state handling
- Learn handoff service enables seamless AiEval tool integration
- Content validation prevents broken lessons from shipping

**Addressed since preflight:**
- All 4 preflight warnings have been properly mitigated in implementation
- Additional safeguards added (session storage for handoff, content validation)

---

## Flow Topology

```
┌─────────────────────────────────────────────────────────────────┐
│ /learn Hub (LearnPage)                                          │
│  - Roadmap: progress bar + Continue CTA                         │
│  - Track lists: Foundation → LLM systems → Go deeper            │
│  - Tools strip: link to /evaluations/new                        │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌──────────┐    ┌──────────────┐
│ Read     │    │ Lab          │
│ Lessons  │    │ Activities   │
└──────────┘    └──────────────┘
    │                 │
    │           ┌─────┴──────┬─────────┬──────────┐
    │           │            │         │          │
    ▼           ▼            ▼         ▼          ▼
/learn/     /learn/labs/  /learn/  /learn/labs/ /learn/labs/
lessons/    neural-       labs/    semantic-    first-
:lessonId   network       train-   search       evaluation
                          vs-test
                                                  │
                                                  │ ?from=learn
                                                  ▼
                                            ┌──────────────┐
                                            │ /evaluations │
                                            │ /new         │
                                            └──────┬───────┘
                                                   │
                                         recordEvaluation()
                                         (LearnHandoffService)
                                                   │
                                                   ▼
                                            ┌──────────────┐
                                            │ Dashboard    │
                                            │ /            │
                                            │ ?from=learn  │
                                            └──────────────┘
                                              - Banner
                                              - Highlight
```

---

## Critical Findings

**None.** All blocking issues from preflight have been resolved.

---

## Warnings

### W1: Optional lab flow excludes optional labs from Continue CTA

**File:line:** `src/app/learn/curriculum.ts:246-254`

```typescript
const LIVE_LESSON_ORDER = LEARN_LESSONS.filter(
  (lesson) => lesson.status === 'live' && !lesson.optional,
).sort(...)
```

**Issue:** Optional labs (`train-vs-test-lab`, `loss-and-updates-lab`) are hidden from:
- Hub track lists (`getHubLessonsForTrack` filters `!lesson.optional`)
- Continue CTA flow (`LIVE_LESSON_ORDER` filters `!lesson.optional`)
- Progress counting (roadmap uses `LIVE_LESSON_ORDER`)

Optional labs ARE navigable via parent lesson links (`getOptionalLabForLesson`), and marking them complete does increment `completedIds` in localStorage.

**Consequence:** If a learner completes an optional lab, their progress count on the roadmap increases, but the Continue CTA may skip over the next optional lab. For example:
1. Complete `train-vs-test` (read)
2. Complete `train-vs-test-lab` (optional) → progress: 2/18
3. Click Continue → goes to `loss-and-updates` (read), not `loss-and-updates-lab` (optional)

**Risk:** Low-Medium. Optional labs are discoverable from parent lessons. However, a completionist learner who did `train-vs-test-lab` may be confused why Continue skips `loss-and-updates-lab`.

**Mitigation (if desired):** Update `getNextLesson` logic to surface optional labs if their parent is complete and the learner has done ANY optional lab. Out of scope for current handoff unless user requests enhancement.

**Plan alignment:** Plan did not explicitly address optional lab flow in preflight findings. This is a new pattern added during implementation (mini-labs feature).

---

## Info Items

### I1: Empty content + disabled Mark complete (by design)

**File:line:** `src/app/learn/learn-progress.service.ts:37-45`

```typescript
canMarkComplete(lesson: LearnLessonMeta): boolean {
  if (lesson.kind === 'interactive') {
    return true;
  }
  if (lesson.kind === 'tool') {
    return walkthroughHasSteps();
  }
  return lessonHasBody(lesson.id);
}
```

**Status:** ✅ **Working as designed.**

Read lessons with empty `sections` arrays disable Mark complete. Hub progress stays at 0 until JSON content is added.

**Evidence:**
- Stub content files exist for all curriculum entries
- Validation ensures live read lessons have `contentFile` references
- Empty state rendering tested in `learn-lesson-page.spec.ts`

**Plan preflight:** Acknowledged as intentional (Info severity).

---

### I2: Continue CTA respects read-before-lab order

**File:line:** `src/app/learn/curriculum.ts:299-306`

```typescript
export function getNextLesson(completedIds: Set<string>): LearnLessonMeta | null {
  for (const lesson of LIVE_LESSON_ORDER) {
    if (!completedIds.has(lesson.id)) {
      return lesson;
    }
  }
  return null;
}
```

**Status:** ✅ **Working as designed.**

`LIVE_LESSON_ORDER` is constructed by sorting live, non-optional lessons by track order (foundation → llm-systems → go-deeper), then by lesson `order` within track. Labs appear after reads because they have higher `order` values and higher prerequisites.

**Example flow:**
1. `learning-from-examples` (order 1, no prereqs)
2. `train-vs-test` (order 2, prereq: learning-from-examples)
3. `loss-and-updates` (order 3, prereq: train-vs-test)
4. `neural-network-lab` (order 4, prereq: loss-and-updates)
5. `prompts-as-instructions` (llm-systems order 1, prereq: neural-network-lab)
...

**Plan preflight:** Mitigated via natural ordering + prerequisites (Warning W3 in preflight resolved).

---

### I3: localStorage stale ID filtering

**File:line:** `src/app/learn/learn-progress.service.ts:47-62`

```typescript
private readStored(): Set<string> {
  const known = getKnownLessonIds();
  ...
  return new Set(parsed.filter((id): id is string => typeof id === 'string' && known.has(id)));
}
```

**Status:** ✅ **Working as designed.**

If curriculum IDs change, old IDs in localStorage are silently dropped. Known IDs come from `LEARN_LESSONS` array in `curriculum.ts`.

**Edge case:** If maintainer renames a lesson ID, learners lose credit for that lesson. No migration path provided.

**Plan preflight:** Mitigated (Warning W2 in preflight resolved).

---

### I4: Walkthrough handoff uses sessionStorage, not localStorage

**File:line:** `src/app/learn/learn-handoff.service.ts:54,64`

```typescript
clear(): void {
  sessionStorage.removeItem(STORAGE_KEY);
  ...
}

private readStored(): LearnHandoffState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
```

**Status:** ✅ **Working as designed.**

Learn handoff state (`evaluationId`, `lessonId`, `bannerDismissed`) is stored in `sessionStorage`, meaning it persists within the browser tab but clears on tab close.

**Consequence:** If learner closes the tab after creating an evaluation from the lab, then reopens the dashboard in a new tab, the banner and highlight will NOT appear.

**Rationale:** Prevents stale highlights from lingering indefinitely. Walkthrough assumes learner stays in the same session.

**Plan preflight:** Not mentioned in preflight; sessionStorage choice appears intentional to scope handoff to active session.

---

## Flow Validation Evidence

### 1. Hub → Lesson/Lab Navigation

**Files inspected:**
- `src/app/app.routes.ts:19-52` — all routes defined
- `src/app/components/learn-track-list/learn-track-list.ts` — renders track lessons with route links
- `src/app/components/learn-roadmap/learn-roadmap.ts:22` — Continue CTA uses `getNextLesson`

**Validation:**
- ✅ All lesson routes follow pattern `/learn/lessons/:lessonId`
- ✅ All lab routes explicitly defined (neural-network, train-vs-test, loss-and-updates, semantic-search, rag-playground, first-evaluation)
- ✅ Legacy redirect `/learn/neural-network` → `/learn/labs/neural-network`
- ✅ Invalid lessonId redirects to `/learn` (validated in `learn-lesson-page.ts:102-106`)

---

### 2. Progress Tracking Integrity

**Files inspected:**
- `src/app/learn/learn-progress.service.ts` — localStorage read/write + filtering
- `src/app/learn/curriculum.ts:280-282` — `getKnownLessonIds` validation
- `src/app/pages/learn-lesson-page/learn-lesson-page.ts:162-169` — mark complete flow

**Validation:**
- ✅ Stale IDs filtered on every read
- ✅ Mark complete only allowed for known IDs
- ✅ Read lessons require `lessonHasBody(lessonId) === true` AND all checks solved
- ✅ Interactive labs always allow mark complete
- ✅ Tool walkthrough requires `walkthroughHasSteps() === true`

**Edge case handled:** Attempting to mark complete an unknown ID is silently ignored (line 22-25 in `learn-progress.service.ts`).

---

### 3. Lesson Locking & Prerequisites

**Files inspected:**
- `src/app/learn/curriculum.ts:284-297` — `prerequisitesMet`, `isLessonLocked`
- `src/app/pages/learn-lesson-page/learn-lesson-page.ts:47-57` — locked computed signal
- `src/app/components/learn-track-list/learn-track-list.ts:42-49` — hub locked state

**Validation:**
- ✅ Read lessons locked if ANY prerequisite incomplete (unless `learnUnlockAll` setting enabled)
- ✅ Interactive/tool labs NOT locked by prerequisites (can navigate but hub shows prereq hint)
- ✅ Locked lessons show lock icon on hub; lesson page shows warning banner
- ✅ Settings service provides `learnUnlockAll` dev flag (bypasses locks)

**Prerequisite graph validated:**
```
learning-from-examples (no prereqs)
  → train-vs-test
    → train-vs-test-lab (optional)
    → loss-and-updates
      → loss-and-updates-lab (optional)
      → neural-network-lab
        → prompts-as-instructions
          → comparing-answers
            → rubrics-and-criteria
              → semantic-memory
                → semantic-search-lab
                  → rag-playground-lab
                    → first-evaluation-lab
                      → automation-and-judges
                        → transformers-overview
                          → production-concerns
                            → building-eval-harnesses
```

All prerequisites reference valid lesson IDs (validated by `curriculum.spec.ts`).

---

### 4. AiEval Tool Integration (Walkthrough Handoff)

**Files inspected:**
- `src/app/learn/content/first-evaluation-lab.json:6-31` — walkthrough steps with `?from=learn`
- `src/app/learn/learn-handoff.service.ts` — handoff state management
- `src/app/pages/create-evaluation-page/create-evaluation-page.ts:47-50,382-387` — `fromLearn` signal + `recordLearnHandoff`
- `src/app/pages/dashboard-page/dashboard-page.ts:36-43,89-97` — highlight + banner logic

**Validation:**
- ✅ Walkthrough step 1 links to `/evaluations/new?from=learn`
- ✅ Create page detects `?from=learn` query param → sets `fromLearn` signal
- ✅ On evaluation create/automation, `recordLearnHandoff(evaluationId)` writes to sessionStorage
- ✅ Dashboard reads handoff state → shows banner + highlights evaluation card
- ✅ Banner dismissible (sets `bannerDismissed: true` without clearing highlight)
- ✅ "Back to Learn" button clears handoff state entirely

**Flow tested in specs:**
- `create-evaluation-page.spec.ts:521-558` — handoff recording
- `dashboard-page.spec.ts:49-84` — banner + highlight rendering

---

### 5. Content Validation & Empty State Handling

**Files inspected:**
- `src/app/learn/learn-content.ts:138-180` — `validateLessonContent`, `validateAllLessonContent`
- `src/app/learn/curriculum.ts:327-375` — `validateCurriculum`
- `src/app/pages/learn-lesson-page/learn-lesson-page.ts:62,86-87` — `hasContent`, `markCompleteEnabled`

**Validation:**
- ✅ `validateCurriculum` checks: duplicate IDs, unknown prerequisites, live reads have contentFile, live lessons have routes, track order contiguity
- ✅ `validateLessonContent` ensures: sections have check questions with prompt/answer/explanation, recap questions present for designated lessons
- ✅ Empty content (sections.length === 0) renders "Content coming soon" empty state
- ✅ Mark complete disabled when content empty OR not all checks solved OR already completed

**Content file coverage:**
```
✅ learning-from-examples.json
✅ train-vs-test.json
✅ loss-and-updates.json
✅ prompts-as-instructions.json
✅ comparing-answers.json
✅ rubrics-and-criteria.json
✅ semantic-memory.json
✅ automation-and-judges.json
✅ transformers-overview.json
✅ production-concerns.json
✅ building-eval-harnesses.json
✅ first-evaluation-lab.json (walkthrough)
✅ hub.json
```

All curriculum lesson IDs have corresponding content loaders in `learn-content.ts:78-90`.

---

### 6. Session State & Check Questions

**Files inspected:**
- `src/app/learn/learn-lesson-session.service.ts` — localStorage session tracking for in-progress lessons
- `src/app/pages/learn-lesson-page/learn-lesson-page.ts:64,66-83` — session state signals
- `src/app/components/learn-check-question/learn-check-question.ts` — answer validation

**Validation:**
- ✅ Session state stored per lessonId in localStorage (`aieval-learn-session-{lessonId}`)
- ✅ Tracks: `sectionsSolved`, `recapSolved`, `collapsed` per section
- ✅ Mark complete requires ALL section checks + recap checks solved
- ✅ Check answer validation case-insensitive, trims whitespace, supports `accept` array for alternate answers
- ✅ Session cleared on mark complete (prevents re-entry bugs)

**Edge case:** If learner marks complete, then lesson content is updated to add more sections, reopening the lesson starts fresh session (old session was cleared). This is correct behavior.

---

## Preflight Mitigations Review

### Preflight W1: Walkthrough steps 4-5 link to dashboard with no eval id

**Plan mitigation:** "Walkthrough JSON should say 'open your evaluation from the dashboard'"

**Implementation check:**
```json
// first-evaluation-lab.json:26-30
{
  "title": "Compare the answers",
  "body": "Open Compare on your evaluation to read each model answer and see how the rubric scores line up...",
  "actionLabel": "Open dashboard",
  "actionRoute": "/?from=learn"
}
```

✅ **RESOLVED.** Body text instructs learner to "open Compare on your evaluation" (assumes they'll click the highlighted card). Dashboard highlights the evaluation via `LearnHandoffService`.

---

### Preflight W2: localStorage completed ids can go stale if curriculum ids change

**Plan mitigation:** "`LearnProgressService` filters to known ids from `curriculum.ts` only"

**Implementation check:**
```typescript
// learn-progress.service.ts:47-62
private readStored(): Set<string> {
  const known = getKnownLessonIds();
  ...
  return new Set(parsed.filter((id): id is string => typeof id === 'string' && known.has(id)));
}
```

✅ **RESOLVED.** Stale IDs silently filtered on every read.

---

### Preflight W3: Labs open while reads locked — Continue must respect order

**Plan mitigation:** "`getNextLesson`: walk foundation reads 1→3, then labs only if all prior reads in track complete"

**Implementation check:**
```typescript
// curriculum.ts:246-254
const LIVE_LESSON_ORDER = LEARN_LESSONS.filter(
  (lesson) => lesson.status === 'live' && !lesson.optional,
).sort((a, b) => {
  const trackDiff = TRACK_ORDER.indexOf(a.trackId) - TRACK_ORDER.indexOf(b.trackId);
  if (trackDiff !== 0) return trackDiff;
  return a.order - b.order;
});
```

✅ **RESOLVED.** Lessons sorted by track, then by order. Prerequisites ensure reads before labs (e.g., `neural-network-lab` has prereq `loss-and-updates`). `getNextLesson` walks `LIVE_LESSON_ORDER` sequentially.

---

### Preflight I1: Empty content + disabled Mark complete

**Plan acknowledgment:** "Intentional; roadmap still navigates via track list"

**Implementation check:**
- ✅ Confirmed: `canMarkComplete` checks `lessonHasBody`
- ✅ Confirmed: Empty state rendered when `sections.length === 0`
- ✅ Confirmed: Roadmap Continue works even with 0 progress

---

## Test Coverage

Test files inspected:
- `curriculum.spec.ts` — validation, prerequisites, getNextLesson
- `learn-progress.service.spec.ts` — stale ID filtering, mark complete
- `learn-content.spec.ts` — content validation
- `learn-lesson-page.spec.ts` — empty state, redirect on invalid ID
- `learn-walkthrough-page.spec.ts` — step rendering
- `learn-roadmap.spec.ts` (implied, not read) — Continue CTA
- `learn-track-list.spec.ts` — track rendering, locked state
- `create-evaluation-page.spec.ts:521-558` — learn handoff recording
- `dashboard-page.spec.ts:49-84` — learn banner + highlight

**Coverage gaps (acceptable for MVP):**
- No E2E test for full walkthrough journey (hub → lesson → lab → create → dashboard)
- No test for optional lab visibility/navigation (new feature)
- No test for session state edge cases (e.g., content updated after session started)

**Recommendation:** Add integration test for walkthrough happy path in future iteration. Current unit test coverage is sufficient for handoff.

---

## Architectural Observations

### Strengths

1. **Clean separation of concerns:** Curriculum metadata, content JSON, and rendering logic are decoupled. Adding a new lesson requires only metadata + JSON file, no component changes.

2. **Robust state management:** Uses Angular signals for reactivity; progress service is stateless (reads from localStorage on demand).

3. **Fail-safe defaults:** Unknown IDs filtered, invalid routes redirect to hub, empty content shows empty state instead of crashing.

4. **Extensible content model:** `LessonSection` supports paragraphs, bullets, reveals, and inline checks. `CheckQuestion` supports multiple-choice via `choices` field.

5. **Developer-friendly validation:** `validateCurriculum` and `validateLessonContent` catch config errors at build time (via spec files).

### Design Trade-offs

1. **No migration for renamed lesson IDs:** If maintainer renames a lesson, learners lose progress. Acceptable for MVP, but consider migration strategy if curriculum becomes stable.

2. **sessionStorage for handoff:** Limits handoff to single browser tab/session. Prevents stale highlights but may confuse learners who close tabs mid-walkthrough.

3. **Hard-coded lesson IDs in components:** Several components reference specific IDs (e.g., `first-evaluation-lab`, `neural-network-lab`). Makes curriculum less generic but simplifies implementation.

4. **No auth-backed progress:** localStorage can be cleared by user. Plan acknowledges this is out of scope; fine for self-directed learning MVP.

5. **Optional labs hidden from Continue flow:** (See W1 above.) Reduces complexity but may confuse completionists.

---

## Recommendations for Future Iterations

### High Priority (if user feedback indicates issues)

1. **Optional lab Continue logic:** Consider surfacing optional labs in Continue flow if learner has completed ANY optional lab (signals engagement).

2. **Handoff localStorage fallback:** Store handoff in localStorage with expiry timestamp (e.g., 24 hours) to survive tab closures.

3. **Integration test:** Add Playwright/Cypress test for walkthrough happy path (create eval from lab → dashboard highlight).

### Medium Priority

4. **Lesson ID migration helper:** Provide a migration mapping in `LearnProgressService` (e.g., `{ oldId: 'foo', newId: 'bar' }`) to preserve progress across renames.

5. **Content authoring validation in CI:** Run `validateAllLessonContent()` as a pre-commit hook or CI check to catch content errors before merge.

6. **Lesson completion analytics:** Track which lessons have high drop-off (many starts, few completes) to identify content issues.

### Low Priority

7. **Glossary term autocomplete:** Help content authors find existing glossary terms when writing new lessons.

8. **Content preview mode:** Allow maintainers to view draft lessons without marking them `status: 'live'`.

9. **Lesson feedback widget:** "Was this helpful?" button on lessons to guide content improvements.

---

## Final Verdict

✅ **APPROVED FOR HANDOFF**

**Rationale:**
- All critical flows validated: hub → lesson/lab → progress → next → AiEval handoff
- Preflight warnings properly mitigated in implementation
- Zero blocking issues; one minor warning (optional lab Continue flow) is low-risk
- Test coverage adequate for MVP
- Code quality is high: clean architecture, robust validation, fail-safe defaults

**Next steps per plan:**
1. ✅ This flow-inspector report completes the `flow-inspector-post` todo
2. User can now proceed with content authoring (fill stub JSON files per `docs/plans/README.md`)
3. Optional: Update `.cursor/skills/aieval-learn-hub/SKILL.md` with maintainer docs (out of scope for this inspection)

**Blockers:** None.

---

## Appendix: File Evidence Index

| Flow Step | Evidence File:Lines |
|-----------|---------------------|
| Hub rendering | `src/app/pages/learn-page/learn-page.ts:1-16` |
| Roadmap Continue CTA | `src/app/components/learn-roadmap/learn-roadmap.ts:22` |
| Track list rendering | `src/app/components/learn-track-list/learn-track-list.ts:1-82` |
| Lesson routes | `src/app/app.routes.ts:42-50` |
| Lesson page navigation | `src/app/pages/learn-lesson-page/learn-lesson-page.ts:102-106` |
| Walkthrough page | `src/app/pages/learn-walkthrough-page/learn-walkthrough-page.ts:1-42` |
| Progress service | `src/app/learn/learn-progress.service.ts:1-67` |
| Curriculum metadata | `src/app/learn/curriculum.ts:1-376` |
| Content loaders | `src/app/learn/learn-content.ts:78-104` |
| Handoff service | `src/app/learn/learn-handoff.service.ts:1-89` |
| Create page handoff | `src/app/pages/create-evaluation-page/create-evaluation-page.ts:47-50,382-387` |
| Dashboard handoff | `src/app/pages/dashboard-page/dashboard-page.ts:36-43,89-97` |
| Walkthrough content | `src/app/learn/content/first-evaluation-lab.json:1-32` |
| Curriculum validation | `src/app/learn/curriculum.ts:327-375` |
| Content validation | `src/app/learn/learn-content.ts:138-180` |
| Session state | `src/app/learn/learn-lesson-session.service.ts:1-107` |

---

**Inspector:** Cloud Agent (flow-inspector skill)  
**Report Format:** Structured markdown per user rule requirements  
**Timestamp:** 2026-07-07 21:30 UTC
