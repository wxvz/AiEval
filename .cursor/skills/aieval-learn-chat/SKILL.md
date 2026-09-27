---
name: aieval-learn-chat
description: >-
  Guides AiEval Learn tutor chat: FAB UI, LearnChatService SSE client,
  /api/learn-chat Express proxy, n8n webhook auth/rate limits, paced reveal,
  cancel/abort, and curriculum grounding. Use when editing learn-chat-fab,
  learn-chat.service, server routes/learn-chat, LEARN_CHAT_* env, tutor
  grounding excerpts, or n8n Learn chat agent prompts.
  Preflight: flow-inspector when editing/running the learn-chat SSE or cancel path.
---

# Learn chat (tutor)

AiEval Learn floating tutor: Angular FAB → `POST /api/learn-chat` → n8n webhook (Groq agent) → JSON or SSE → paced UI reveal.

## File map

| File | Role |
|------|------|
| `src/app/components/learn-chat-fab/` | Panel UI, thinking dots, paced reveal, cancel on close/toggle/nav/destroy |
| `src/app/services/learn-chat.service.ts` | Session id, context sync, `ask()` + SSE `consumeSse`, `AbortController` cancel |
| `src/app/learn/learn-tutor-grounding.ts` | Page term senses + keyword excerpts/sources for the request body |
| `server/src/routes/learn-chat.ts` | Proxy, secret gate, rate limit, timeout + **client-disconnect** abort of n8n fetch, SSE chunking |
| `server/src/config.ts` | `LEARN_CHAT_WEBHOOK_URL`, `LEARN_CHAT_WEBHOOK_SECRET`, `LEARN_CHAT_RATE_LIMIT_PER_MINUTE` |
| n8n workflow **Learn chat** | Header Auth webhook → curriculum context → Groq agent → `{ reply, sessionId, sources }` |

## Request flow

```
1. FAB send → placeholder user + empty assistant bubble; thinking dots
2. LearnChatService.ask(stream: true, Accept: text/event-stream)
3. Express: URL+secret required (503 fail closed) → rate limit → validate
4. fetch(n8n) with AbortSignal (timeout OR client disconnect)
5. sendChatResult: SSE token events via chunkReply, then done (not live upstream stream)
6. FAB buffers tokens → min 300–500ms dots → paced reveal → snap reply+sources
```

Context-only: `action: 'context'` (no LLM) on route enter / panel open.

## Cancel / abort checklist

When changing cancel behavior, verify all of these:

- [ ] **Close** (panel X) and **toggle dismiss** both call `cancel()` + `stopReveal()`
- [ ] **NavigationEnd** cancels in-flight ask/sync **and** stops reveal
- [ ] **Destroy** cancels service fetch (not only `stopReveal`)
- [ ] Success path does **not** snap `response.reply` when `revealAbort` is true
- [ ] Empty assistant placeholder dropped on cancel; non-empty partial may remain
- [ ] Server aborts n8n `fetch` when the client connection closes mid-request
- [ ] `prefers-reduced-motion`: skip thinking delay + paced reveal

## Auth and limits

| Concern | Rule |
|---------|------|
| Secret | `LEARN_CHAT_WEBHOOK_SECRET` required whenever URL is set; header `X-Learn-Chat-Secret` |
| Rate limit | Soft per-IP (or session fallback) rolling minute; **do not** trust raw `X-Forwarded-For` without Express `trust proxy` |
| Timeouts | Chat vs context timeouts in `learn-chat.ts`; client abort is separate |

## UI reveal

- Thinking dots while `thinking()` and assistant text empty
- Client paces tokens because server dumps SSE after the webhook returns
- Sources chips after snap; markdown via `app-learn-lesson-text`

## Grounding

Client sends `lessonId`, `route`, `termHints`, `excerpts`, `sources`, and `curriculumCatalog` from `learn-tutor-grounding`.

- Prefer **CURRENT PAGE** excerpts; when the page has no content or weak overlap, **cross-retrieve** other live lessons (e.g. bias question on the RAG lab → Bias and weights).
- `curriculumCatalog` is the allowlist of live titles/routes. n8n must treat CURRICULUM CATALOG / MATCHED SOURCES as the only citeable lesson names.
- Client and server drop invented `sources` chips that are not in the catalog.
- Prefer **literal TERM SENSES** over teaching metaphors in excerpts. n8n system prompt must drop a rejected analogy immediately (do not dig into the metaphor the learner refused).

n8n system prompt must treat CURRENT PAGE / TERM SENSES / LESSON EXCERPTS as authoritative; closers (okay/thanks) get a short wrap-up, not re-pitched lessons. **Only non-social turns get source chips** (`shouldAttachLearnChatSources`: deny an explicit social-closer allowlist such as hi/ok/thanks; short term prompts like `bias` keep chips) — Format Reply and Express must not echo page matches for those closers.

## Scoring revision note

`computeScoringConfigRevision` includes `prompt`. Client `scoresMayBeStale` grandfathers **pre-prompt** hashes via `computeLegacyScoringConfigRevision` so deploy does not mark every historical score stale. New automation runs write the prompt-aware hash.

## Tests

| Spec | Covers |
|------|--------|
| `learn-chat-fab.spec.ts` | Open, stream paint, thinking dots, cancel/toggle mid-send |
| `learn-chat.service.spec.ts` | SSE tokens, context sync, cancel, errors |
| `server/src/routes/learn-chat.test.ts` | 503 secret/URL, SSE shape, rate limit, disconnect abort |

After changes: scoped specs, then `aieval-keep-tests-current` / `npm run ci` before merge.

## Related

- Curriculum shell (not chat): `aieval-learn-hub`
- Judge/LLM prompts elsewhere: `aieval-prompts-and-judge`
