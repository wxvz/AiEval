import { Router } from 'express';

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

function asOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSources(value: unknown): LearnChatSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const title = asOptionalString(record['title']) ?? undefined;
      const route = asOptionalString(record['route']) ?? undefined;
      if (!title && !route) {
        return null;
      }
      return { title, route };
    })
    .filter((entry): entry is LearnChatSource => entry !== null)
    .slice(0, 5);
}

function normalizeTermHints(value: unknown): TermHint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const term = asOptionalString(record['term']);
      const label = asOptionalString(record['label']);
      const sense = asOptionalString(record['sense']);
      if (!term || !label || !sense) {
        return null;
      }
      return {
        term,
        label,
        sense: sense.slice(0, MAX_SENSE_LENGTH),
      };
    })
    .filter((entry): entry is TermHint => entry !== null)
    .slice(0, MAX_TERM_HINTS);
}

function normalizeExcerpts(value: unknown): Excerpt[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const record = entry as Record<string, unknown>;
      const text = asOptionalString(record['text']);
      if (!text) {
        return null;
      }
      const heading = asOptionalString(record['heading']) ?? undefined;
      return {
        text: text.slice(0, MAX_EXCERPT_TEXT),
        heading,
      };
    })
    .filter((entry): entry is Excerpt => entry !== null)
    .slice(0, MAX_EXCERPTS);
}

function normalizeResponse(payload: unknown, fallbackSessionId: string): LearnChatResponse {
  const record =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};

  const reply = asOptionalString(record['reply']) ?? 'No reply generated.';
  const sessionId = asOptionalString(record['sessionId']) ?? fallbackSessionId;

  return {
    reply,
    sessionId,
    sources: normalizeSources(record['sources']),
  };
}

export function createLearnChatRouter(): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const webhookUrl = config.learnChatWebhookUrl;

    if (!webhookUrl) {
      res.status(503).json({
        message: 'Learn chat is not configured. Set LEARN_CHAT_WEBHOOK_URL.',
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
    const termHints = normalizeTermHints(req.body?.termHints);
    const excerpts = action === 'chat' ? normalizeExcerpts(req.body?.excerpts) : [];
    const sources = action === 'chat' ? normalizeSources(req.body?.sources) : [];

    if (action === 'chat') {
      if (!message) {
        res.status(400).json({
          reply: 'Send a non-empty message.',
          sessionId,
          sources: [],
        } satisfies LearnChatResponse);
        return;
      }

      if (message.length > MAX_MESSAGE_LENGTH) {
        res.status(400).json({
          reply: 'Message is too long (max 2000 characters).',
          sessionId,
          sources: [],
        } satisfies LearnChatResponse);
        return;
      }
    }

    const controller = new AbortController();
    const timeoutMs = action === 'context' ? CONTEXT_TIMEOUT_MS : WEBHOOK_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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
          };

    try {
      const upstream = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
          res.status(502).json({
            reply: 'The tutor returned an invalid response. Try again.',
            sessionId,
            sources: [],
          } satisfies LearnChatResponse);
          return;
        }
      }

      if (!upstream.ok) {
        if (action === 'context') {
          res.status(502).json({ message: 'Context sync failed.', sessionId });
          return;
        }
        const normalized = normalizeResponse(payload, sessionId);
        // Keep a stable API surface: client always sees 502 for upstream failures
        // (n8n may return 400/5xx with a partial body).
        res.status(502).json({
          reply:
            normalized.reply !== 'No reply generated.'
              ? normalized.reply
              : 'The tutor could not answer right now. Try again.',
          sessionId: normalized.sessionId,
          sources: [],
        } satisfies LearnChatResponse);
        return;
      }

      if (payload === null) {
        if (action === 'context') {
          res.status(502).json({ message: 'Context sync failed.', sessionId });
          return;
        }
        res.status(502).json({
          reply: 'The tutor returned an empty response. Try again.',
          sessionId,
          sources: [],
        } satisfies LearnChatResponse);
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

      res.status(200).json(normalizeResponse(payload, sessionId));
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      logEvent('error', LogEvents.httpError, {
        message: aborted
          ? action === 'context'
            ? 'Learn chat context sync timed out'
            : 'Learn chat webhook timed out'
          : error instanceof Error
            ? error.message
            : 'Learn chat webhook failed',
      });
      if (action === 'context') {
        res.status(504).json({ message: 'Context sync timed out.', sessionId });
        return;
      }
      res.status(504).json({
        reply: aborted
          ? 'The tutor timed out. Try a shorter question.'
          : 'Could not reach the tutor. Try again.',
        sessionId,
        sources: [],
      } satisfies LearnChatResponse);
    } finally {
      clearTimeout(timer);
    }
  });

  return router;
}
