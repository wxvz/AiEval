---
name: aieval-api-auth
description: >-
  Optional AiEval API token gate (AIEVAL_API_TOKEN), TRUST_PROXY, Bearer
  HttpInterceptor + localStorage, EventSource api_token query for automate SSE,
  request-log redaction, and open health/status/settings GET paths. Use when
  editing api-token middleware, request-logger redaction, api-token interceptor,
  ServerSettingsService token UI, EvaluationService EventSource auth, or
  LEARN_CHAT / evaluations mounts behind requireApiToken.
  Preflight: flow-inspector when editing/running the API token or automate SSE auth path.
---

# AiEval API auth (optional token)

Local-first posture: when `AIEVAL_API_TOKEN` is **unset**, mutate/proxy routes stay open. When **set**, Bearer (or EventSource query token) is required.

## File map

| File | Role |
|------|------|
| `server/src/config.ts` | `apiToken` (`AIEVAL_API_TOKEN`), `trustProxy` (`TRUST_PROXY`) |
| `server/src/middleware/api-token.ts` | `requireApiToken`, `isApiTokenRequired`; Bearer preferred; `?api_token=` for SSE |
| `server/src/middleware/request-logger.ts` | Redact `api_token` / `authorization` query values before logging `path` |
| `server/src/index.ts` | `trust proxy` when enabled; mount token on `/api/evaluations`, `/api/learn-chat` |
| `server/src/routes/settings.ts` | GET open + `apiTokenRequired`; PATCH uses `requireApiToken` |
| `src/app/utils/api-token.storage.ts` | `localStorage` key for client token |
| `src/app/interceptors/api-token.interceptor.ts` | Bearer on `/api/*` HttpClient calls |
| `src/app/services/server-settings.service.ts` | `apiTokenRequired` signal; get/set stored token |
| `src/app/components/settings-aside/` | Token field + empty-state banner when required and unset |
| `src/app/services/evaluation.service.ts` | EventSource appends `api_token` query (cannot set Authorization) |
| `src/app/services/learn-chat.service.ts` | Raw `fetch` must add Bearer when token stored |
| `.env.example` | Documents token, trust proxy, EventSource query / proxy-log tradeoff |

## Always open (no token)

- `GET /api/health` — liveness
- `GET /api/status` — readiness probes
- `GET /api/settings` — so UI can learn `apiTokenRequired`

## Auth checklist

When changing token / SSE auth behavior:

- [ ] Unset token → all routes behave as before (open local)
- [ ] Set token → evaluations + learn-chat + settings PATCH require auth; health/status/settings GET stay open
- [ ] HttpClient paths get Bearer via interceptor
- [ ] Automate `EventSource` gets `?api_token=` (browsers cannot set Authorization on EventSource)
- [ ] Request logger redacts `api_token` from logged paths
- [ ] Missing token UX: Settings banner; 401 / connection errors mention API token / Settings
- [ ] `TRUST_PROXY=true` only behind a reverse proxy (startup warn); do not trust raw `X-Forwarded-For` when off
- [ ] Prefer Bearer for non-SSE; document query-token proxy-log risk in `.env.example`

## Flow notes

```
1. GET /api/settings → apiTokenRequired
2. User stores token in Settings (localStorage)
3. HttpClient → Authorization: Bearer …
4. EventSource automate → ?api_token=… (SSE only)
5. requireApiToken: Bearer preferred over query; mismatch → 401
```

## Tests

- `server/src/middleware/api-token.test.ts`
- `server/src/middleware/request-logger.test.ts` (redaction)
- `src/app/interceptors/api-token.interceptor.spec.ts`
- Automate specs for `api_token` query append + connection 401 messaging

## Related

- `aieval-learn-chat` — learn-chat also sits behind `requireApiToken` when token is set
- `aieval-automation-debug` — automate SSE cancel / timeout; auth is this skill’s concern
