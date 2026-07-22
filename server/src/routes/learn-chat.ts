import { Router, type Request, type Response } from 'express';

import { config } from '../config.js';
import { LogEvents } from '../logging/events.js';
import { logEvent } from '../logging/logger.js';

const MAX_MESSAGE_LENGTH = 2000;
const WEBHOOK_TIMEOUT_MS = 60_000;
const CONTEXT_TIMEOUT_MS = 15_000;
const MAX_TERM_HINTS = 8;
const MAX_EXCERPTS = 5;
const MAX_EXCERPT_TEXT = 600;
const MAX_SENSE_LENGTH = 400;
const MAX_CATALOG = 80;
const RATE_LIMIT_WINDOW_MS = 60_000;
const SECRET_HEADER = 'X-Learn-Chat-Secret';

export interface LearnChatSource {
  title?: string;
  route?: string;
}

export interface LearnChatResponse {
  reply: string;
  sessionId: string;
  sources: LearnChatSource[];
}

export interface LearnChatContextResponse {
  ok: true;
  sessionId: string;
}

interface TermHint {
  term: string;
  label: string;
  sense: string;
}

interface Excerpt {
  text: string;
  heading?: string;
}

interface CatalogEntry {
  title: string;
  route: string;
}

interface NormalizeResult<T> {
  items: T[];
  truncated: boolean;
}

/** Rolling-window counters keyed by client IP or sessionId. */
const rateLimitHits = new Map<string, number[]>();

/** Test helper — clears the in-memory rate-limit window. */
export function resetLearnChatRateLimitState(): void {
  rateLimitHits.clear();
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function wantsStream(req: Request): boolean {
  const accept = String(req.headers.accept ?? '');
  if (accept.includes('text/event-stream')) {
    return true;
  }
  return req.body?.stream === true;
}

function clientRateKey(req: Request, sessionId: string): string {
  // Do not trust X-Forwarded-For without Express `trust proxy` — clients can spoof it.
  const ip = String(req.ip || req.socket.remoteAddress || '').trim();
  return ip ? `ip:${ip}` : `session:${sessionId}`;
}

function checkRateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const recent = (rateLimitHits.get(key) ?? []).filter(
    (stamp) => now - stamp < RATE_LIMIT_WINDOW_MS,
  );
  if (recent.length >= maxPerMinute) {
    rateLimitHits.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLimitHits.set(key, recent);
  return true;
}

function normalizeSources(value: unknown): NormalizeResult<LearnChatSource> {
  if (!Array.isArray(value)) {
    return { items: [], truncated: false };
  }

  const sources: LearnChatSource[] = [];
  let truncated = value.length > 5;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const title = asOptionalString(record['title']);
    const route = asOptionalString(record['route']);
    if (!title && !route) {
      continue;
    }
    const source: LearnChatSource = {};
    if (title) {
      source.title = title;
    }
    if (route) {
      source.route = route;
    }
    sources.push(source);
    if (sources.length >= 5) {
      truncated = truncated || value.length > sources.length;
      break;
    }
  }
  return { items: sources, truncated };
}

function normalizeCatalog(value: unknown): NormalizeResult<CatalogEntry> {
  if (!Array.isArray(value)) {
    return { items: [], truncated: false };
  }

  const catalog: CatalogEntry[] = [];
  let truncated = value.length > MAX_CATALOG;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const title = asOptionalString(record['title']);
    const route = asOptionalString(record['route']);
    if (!title || !route) {
      continue;
    }
    catalog.push({ title: title.slice(0, 120), route: route.slice(0, 200) });
    if (catalog.length >= MAX_CATALOG) {
      truncated = truncated || value.length > catalog.length;
      break;
    }
  }
  return { items: catalog, truncated };
}

/** Drop invented source chips that are not in the curriculum catalog or request sources. */
function filterSourcesToCatalog(
  sources: LearnChatSource[],
  catalog: CatalogEntry[],
  requestSources: LearnChatSource[],
): LearnChatSource[] {
  if (catalog.length === 0 && requestSources.length === 0) {
    return sources;
  }

  const byRoute = new Map<string, CatalogEntry>();
  const byTitle = new Map<string, CatalogEntry>();
  for (const entry of [...catalog, ...requestSources]) {
    if (entry.route && entry.title) {
      byRoute.set(entry.route, { title: entry.title, route: entry.route });
      byTitle.set(entry.title.toLowerCase(), { title: entry.title, route: entry.route });
    } else if (entry.route) {
      byRoute.set(entry.route, { title: entry.title ?? entry.route, route: entry.route });
    } else if (entry.title) {
      byTitle.set(entry.title.toLowerCase(), {
        title: entry.title,
        route: entry.route ?? '',
      });
    }
  }

  const filtered: LearnChatSource[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    const match =
      (source.route ? byRoute.get(source.route) : undefined) ??
      (source.title ? byTitle.get(source.title.toLowerCase()) : undefined);
    if (!match) {
      continue;
    }
    const key = match.route || match.title;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const next: LearnChatSource = { title: match.title };
    if (match.route) {
      next.route = match.route;
    }
    filtered.push(next);
    if (filtered.length >= 5) {
      break;
    }
  }
  return filtered;
}

function normalizeTermHints(value: unknown): NormalizeResult<TermHint> {
  if (!Array.isArray(value)) {
    return { items: [], truncated: false };
  }

  const hints: TermHint[] = [];
  let truncated = value.length > MAX_TERM_HINTS;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const term = asOptionalString(record['term']);
    const label = asOptionalString(record['label']);
    const sense = asOptionalString(record['sense']);
    if (!term || !label || !sense) {
      continue;
    }
    if (sense.length > MAX_SENSE_LENGTH) {
      truncated = true;
    }
    hints.push({
      term,
      label,
      sense: sense.slice(0, MAX_SENSE_LENGTH),
    });
    if (hints.length >= MAX_TERM_HINTS) {
      truncated = truncated || value.length > hints.length;
      break;
    }
  }
  return { items: hints, truncated };
}

function normalizeExcerpts(value: unknown): NormalizeResult<Excerpt> {
  if (!Array.isArray(value)) {
    return { items: [], truncated: false };
  }

  const excerpts: Excerpt[] = [];
  let truncated = value.length > MAX_EXCERPTS;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const text = asOptionalString(record['text']);
    if (!text) {
      continue;
    }
    if (text.length > MAX_EXCERPT_TEXT) {
      truncated = true;
    }
    const excerpt: Excerpt = { text: text.slice(0, MAX_EXCERPT_TEXT) };
    const heading = asOptionalString(record['heading']);
    if (heading) {
      excerpt.heading = heading;
    }
    excerpts.push(excerpt);
    if (excerpts.length >= MAX_EXCERPTS) {
      truncated = truncated || value.length > excerpts.length;
      break;
    }
  }
  return { items: excerpts, truncated };
}

function normalizeResponse(
  payload: unknown,
  fallbackSessionId: string,
  catalog: CatalogEntry[] = [],
  requestSources: LearnChatSource[] = [],
): LearnChatResponse {
  const record =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

  const reply = asOptionalString(record['reply']) ?? 'No reply generated.';
  const sessionId = asOptionalString(record['sessionId']) ?? fallbackSessionId;
  const rawSources = normalizeSources(record['sources']).items;

  return {
    reply,
    sessionId,
    sources: filterSourcesToCatalog(rawSources, catalog, requestSources),
  };
}

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Split reply into small chunks so the FAB can append tokens progressively. */
function chunkReply(reply: string): string[] {
  const parts = reply.match(/\S+\s*/g);
  if (!parts || parts.length === 0) {
    return reply ? [reply] : [];
  }
  const chunks: string[] = [];
  let buffer = '';
  for (const part of parts) {
    buffer += part;
    if (buffer.length >= 24) {
      chunks.push(buffer);
      buffer = '';
    }
  }
  if (buffer) {
    chunks.push(buffer);
  }
  return chunks;
}

function sendChatJson(res: Response, status: number, body: LearnChatResponse): void {
  res.status(status).json(body);
}

function sendChatResult(
  res: Response,
  status: number,
  body: LearnChatResponse,
  stream: boolean,
): void {
  if (!stream) {
    sendChatJson(res, status, body);
    return;
  }

  res.status(status);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (status >= 400) {
    writeSse(res, 'error', body);
    res.end();
    return;
  }

  for (const token of chunkReply(body.reply)) {
    writeSse(res, 'token', { text: token });
  }
  writeSse(res, 'done', {
    reply: body.reply,
    sessionId: body.sessionId,
    sources: body.sources,
  });
  res.end();
}

export function createLearnChatRouter(): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const webhookUrl = config.learnChatWebhookUrl;
    const webhookSecret = config.learnChatWebhookSecret;
    const stream = wantsStream(req);

    if (!webhookUrl) {
      res.status(503).json({
        message: 'Learn chat is not configured. Set LEARN_CHAT_WEBHOOK_URL.',
      });
      return;
    }

    if (!webhookSecret) {
      res.status(503).json({
        message:
          'Learn chat is not configured. Set LEARN_CHAT_WEBHOOK_SECRET (required with LEARN_CHAT_WEBHOOK_URL).',
      });
      return;
    }

    const action = asOptionalString(req.body?.action) === 'context' ? 'context' : 'chat';
    const message = asOptionalString(req.body?.message);
    const sessionId =
      asOptionalString(req.body?.sessionId) ?? `anon-${Date.now()}`;
    const lessonId = asOptionalString(req.body?.lessonId);
    const route = asOptionalString(req.body?.route);
    const lessonTitle = asOptionalString(req.body?.lessonTitle);
    const lessonSummary = asOptionalString(req.body?.lessonSummary);
    const hintResult = normalizeTermHints(req.body?.termHints);
    const excerptResult =
      action === 'chat' ? normalizeExcerpts(req.body?.excerpts) : { items: [], truncated: false };
    const sourceResult =
      action === 'chat' ? normalizeSources(req.body?.sources) : { items: [], truncated: false };
    const catalogResult =
      action === 'chat'
        ? normalizeCatalog(req.body?.curriculumCatalog)
        : { items: [], truncated: false };
    const termHints = hintResult.items;
    const excerpts = excerptResult.items;
    const sources = sourceResult.items;
    const curriculumCatalog = catalogResult.items;

    if (
      hintResult.truncated ||
      excerptResult.truncated ||
      sourceResult.truncated ||
      catalogResult.truncated
    ) {
      logEvent('info', LogEvents.learnChatTruncated, {
        message: 'Learn chat grounding fields truncated by server caps',
        action,
        termHintsTruncated: hintResult.truncated,
        excerptsTruncated: excerptResult.truncated,
        sourcesTruncated: sourceResult.truncated,
        catalogTruncated: catalogResult.truncated,
        termHintCount: termHints.length,
        excerptCount: excerpts.length,
        sourceCount: sources.length,
        catalogCount: curriculumCatalog.length,
      });
    }

    const rateKey = clientRateKey(req, sessionId);
    if (!checkRateLimit(rateKey, config.learnChatRateLimitPerMinute)) {
      logEvent('warn', LogEvents.learnChatRateLimited, {
        message: 'Learn chat rate limit exceeded',
        action,
        rateKey,
      });
      if (action === 'context') {
        res.status(429).json({ message: 'Too many requests. Try again shortly.', sessionId });
        return;
      }
      sendChatResult(
        res,
        429,
        {
          reply: 'Too many requests. Try again shortly.',
          sessionId,
          sources: [],
        },
        stream,
      );
      return;
    }

    if (action === 'chat') {
      if (!message) {
        sendChatResult(
          res,
          400,
          {
            reply: 'Send a non-empty message.',
            sessionId,
            sources: [],
          },
          stream,
        );
        return;
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        sendChatResult(
          res,
          400,
          {
            reply: 'Message is too long (max 2000 characters).',
            sessionId,
            sources: [],
          },
          stream,
        );
        return;
      }
    }

    const controller = new AbortController();
    const timeoutMs = action === 'context' ? CONTEXT_TIMEOUT_MS : WEBHOOK_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromClient = (): void => {
      controller.abort();
    };
    // Abort upstream work if the browser disconnects before we finish.
    req.once('aborted', abortFromClient);
    res.once('close', () => {
      if (!res.writableEnded) {
        abortFromClient();
      }
    });

    const webhookBody =
      action === 'context'
        ? {
            action: 'context' as const,
            sessionId,
            lessonId,
            route,
            lessonTitle,
            lessonSummary,
            termHints,
          }
        : {
            action: 'chat' as const,
            message,
            sessionId,
            lessonId,
            route,
            lessonTitle,
            lessonSummary,
            termHints,
            excerpts,
            sources,
            curriculumCatalog,
          };

    try {
      const upstream = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          [SECRET_HEADER]: webhookSecret,
        },
        body: JSON.stringify(webhookBody),
        signal: controller.signal,
      });

      const rawText = await upstream.text();
      let payload: unknown = null;

      if (rawText.trim()) {
        try {
          payload = JSON.parse(rawText) as unknown;
        } catch {
          logEvent('warn', LogEvents.httpError, {
            message: 'Learn chat webhook returned non-JSON body',
            status: upstream.status,
          });
          if (action === 'context') {
            res.status(502).json({ message: 'Context sync failed.', sessionId });
            return;
          }
          sendChatResult(
            res,
            502,
            {
              reply: 'The tutor returned an invalid response. Try again.',
              sessionId,
              sources: [],
            },
            stream,
          );
          return;
        }
      }

      if (!upstream.ok) {
        if (action === 'context') {
          const status = upstream.status === 403 || upstream.status === 401 ? upstream.status : 502;
          res.status(status).json({
            message:
              status === 403 || status === 401
                ? 'Learn chat webhook rejected the request.'
                : 'Context sync failed.',
            sessionId,
          });
          return;
        }
        const normalized = normalizeResponse(payload, sessionId, curriculumCatalog, sources);
        const status = upstream.status === 403 || upstream.status === 401 ? upstream.status : 502;
        sendChatResult(
          res,
          status,
          {
            reply:
              status === 403 || status === 401
                ? 'The tutor rejected the request.'
                : normalized.reply !== 'No reply generated.'
                  ? normalized.reply
                  : 'The tutor could not answer right now. Try again.',
            sessionId: normalized.sessionId,
            sources: [],
          },
          stream,
        );
        return;
      }

      if (payload === null) {
        if (action === 'context') {
          res.status(502).json({ message: 'Context sync failed.', sessionId });
          return;
        }
        sendChatResult(
          res,
          502,
          {
            reply: 'The tutor returned an empty response. Try again.',
            sessionId,
            sources: [],
          },
          stream,
        );
        return;
      }

      if (action === 'context') {
        const record =
          payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
        const ok = record['ok'] === true;
        const resolvedSession =
          asOptionalString(record['sessionId']) ?? sessionId;
        if (!ok) {
          res.status(502).json({ message: 'Context sync failed.', sessionId: resolvedSession });
          return;
        }
        res.status(200).json({
          ok: true,
          sessionId: resolvedSession,
        } satisfies LearnChatContextResponse);
        return;
      }

      sendChatResult(
        res,
        200,
        normalizeResponse(payload, sessionId, curriculumCatalog, sources),
        stream,
      );
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      const clientGone = req.destroyed || res.destroyed || !res.writable;
      if (aborted && clientGone) {
        logEvent('info', LogEvents.httpError, {
          message:
            action === 'context'
              ? 'Learn chat context sync aborted (client disconnected)'
              : 'Learn chat webhook aborted (client disconnected)',
        });
        return;
      }
      logEvent('error', LogEvents.httpError, {
        message: aborted
          ? action === 'context'
            ? 'Learn chat context sync timed out'
            : 'Learn chat webhook timed out'
          : error instanceof Error
            ? error.message
            : 'Learn chat webhook failed',
      });
      if (res.headersSent || res.destroyed) {
        return;
      }
      if (action === 'context') {
        res.status(504).json({ message: 'Context sync timed out.', sessionId });
        return;
      }
      sendChatResult(
        res,
        504,
        {
          reply: aborted
            ? 'The tutor timed out. Try a shorter question.'
            : 'Could not reach the tutor. Try again.',
          sessionId,
          sources: [],
        },
        stream,
      );
    } finally {
      clearTimeout(timer);
      req.off('aborted', abortFromClient);
    }
  });

  return router;
}
