import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EmptyError, Subject, firstValueFrom, takeUntil } from 'rxjs';

import { getLessonByRoute } from '../learn/curriculum';
import {
  filterKnownTutorSources,
  getTutorCurriculumCatalog,
  getTutorExcerpts,
  getTutorPageGrounding,
  type TutorCatalogEntry,
  type TutorExcerpt,
  type TutorTermHint,
} from '../learn/learn-tutor-grounding';
import { messageFromHttpError } from './http-error-message';
import { readStoredApiToken } from './api-token.storage';

const API = '/api/learn-chat';
const SESSION_KEY = 'aieval-learn-chat-session-id';

export interface LearnChatSource {
  title?: string;
  route?: string;
}

export interface LearnChatPageContext {
  lessonId: string | null;
  lessonTitle: string | null;
  lessonSummary: string | null;
  termHints: TutorTermHint[];
  route: string;
}

export interface LearnChatRequest {
  action?: 'chat' | 'context';
  message?: string;
  sessionId: string;
  lessonId: string | null;
  lessonTitle: string | null;
  lessonSummary: string | null;
  termHints: TutorTermHint[];
  route: string;
  excerpts?: TutorExcerpt[];
  sources?: LearnChatSource[];
  /** Live lesson titles/routes the model may cite. */
  curriculumCatalog?: TutorCatalogEntry[];
  stream?: boolean;
}

export interface LearnChatResponse {
  reply: string;
  sessionId: string;
  sources: LearnChatSource[];
}

export interface LearnChatAskOptions {
  /** Called as SSE token chunks arrive (streaming replies). */
  onToken?: (token: string) => void;
}

@Injectable({
  providedIn: 'root',
})
export class LearnChatService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly cancelInflight$ = new Subject<void>();
  private lastSyncedKey: string | null = null;
  /** Soft debug flag — chat does not depend on store sync succeeding. */
  lastSyncOk: boolean | null = null;
  private abortController: AbortController | null = null;

  getSessionId(): string {
    const existing = sessionStorage.getItem(SESSION_KEY)?.trim();
    if (existing) {
      return existing;
    }

    const created =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `learn-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  }

  contextFromRouter(): LearnChatPageContext {
    const route = this.router.url.split(/[?#]/, 2)[0] || '/learn';
    // Prefer curriculum route lookup so short lab slugs (e.g. /learn/labs/softmax)
    // still map to their full lesson ids.
    let lessonId: string | null = getLessonByRoute(route)?.id ?? null;
    if (!lessonId) {
      const lessonMatch = /^\/learn\/lessons\/([^/]+)/.exec(route);
      if (lessonMatch) {
        lessonId = decodeURIComponent(lessonMatch[1]);
      }
    }

    const grounding = getTutorPageGrounding(lessonId);
    return {
      lessonId,
      lessonTitle: grounding.lessonTitle,
      lessonSummary: grounding.lessonSummary,
      termHints: grounding.termHints,
      route,
    };
  }

  /** Cancel any in-flight tutor request (chat or context sync). */
  cancel(): void {
    this.cancelInflight$.next();
    this.abortController?.abort();
    this.abortController = null;
  }

  private groundingSyncKey(
    sessionId: string,
    ctx: LearnChatPageContext,
  ): string {
    const hints = ctx.termHints.map((hint) => hint.term).join(',');
    return `${sessionId}|${ctx.route}|${ctx.lessonId ?? ''}|${ctx.lessonTitle ?? ''}|${ctx.lessonSummary ?? ''}|${hints}`;
  }

  /**
   * Push current Learn page into tutor session storage without an LLM reply.
   * Best-effort: failures are swallowed so navigation stays snappy.
   */
  async syncContext(): Promise<void> {
    const sessionId = this.getSessionId();
    const ctx = this.contextFromRouter();

    if (!ctx.route.startsWith('/learn')) {
      return;
    }

    const key = this.groundingSyncKey(sessionId, ctx);
    if (key === this.lastSyncedKey) {
      return;
    }

    const body: LearnChatRequest = {
      action: 'context',
      sessionId,
      lessonId: ctx.lessonId,
      lessonTitle: ctx.lessonTitle,
      lessonSummary: ctx.lessonSummary,
      termHints: ctx.termHints,
      route: ctx.route,
    };

    // Drop any prior in-flight sync/ask before starting a new context POST.
    this.cancelInflight$.next();

    try {
      const response = await firstValueFrom(
        this.http
          .post<{ ok?: boolean; sessionId?: string }>(API, body)
          .pipe(takeUntil(this.cancelInflight$)),
      );
      if (response.sessionId) {
        sessionStorage.setItem(SESSION_KEY, response.sessionId);
      }
      this.lastSyncedKey = key;
      this.lastSyncOk = true;
    } catch (error) {
      if (error instanceof EmptyError) {
        // Cancelled — do not mark sync ok or update lastSyncedKey.
        return;
      }
      this.lastSyncOk = false;
      // Silent sync must not surface in the chat UI.
    }
  }

  async ask(message: string, options: LearnChatAskOptions = {}): Promise<LearnChatResponse> {
    const trimmed = message.trim();
    const sessionId = this.getSessionId();
    const ctx = this.contextFromRouter();

    if (!trimmed) {
      return {
        reply: 'Send a non-empty message.',
        sessionId,
        sources: [],
      };
    }

    const { excerpts, sources, relatedTermHints } = getTutorExcerpts(ctx.lessonId, trimmed);
    const termHints =
      ctx.termHints.length > 0 ? ctx.termHints : relatedTermHints;
    const curriculumCatalog = getTutorCurriculumCatalog();

    const body: LearnChatRequest = {
      action: 'chat',
      message: trimmed,
      sessionId,
      lessonId: ctx.lessonId,
      lessonTitle: ctx.lessonTitle,
      lessonSummary: ctx.lessonSummary,
      termHints,
      route: ctx.route,
      excerpts,
      sources,
      curriculumCatalog,
      stream: true,
    };

    // Drop any prior in-flight ask/sync before starting a new one.
    this.cancel();
    const controller = new AbortController();
    this.abortController = controller;
    const cancelSub = this.cancelInflight$.subscribe(() => controller.abort());

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      };
      const apiToken = readStoredApiToken();
      if (apiToken) {
        headers['Authorization'] = `Bearer ${apiToken}`;
      }

      const response = await fetch(API, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const fallback = await this.readErrorReply(response, sessionId);
        if (response.status === 401) {
          throw new Error(
            messageFromHttpError(
              { status: 401, error: { message: fallback } },
              'Could not reach the tutor.',
            ),
          );
        }
        throw new Error(fallback);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream') && response.body) {
        const streamed = await this.consumeSse(response.body, options.onToken, sessionId);
        if (streamed.sessionId) {
          sessionStorage.setItem(SESSION_KEY, streamed.sessionId);
        }
        // Do not set lastSyncedKey here — only context sync owns that key.
        return streamed;
      }

      const json = (await response.json()) as LearnChatResponse;
      const normalized: LearnChatResponse = {
        reply: json.reply?.trim() || 'No reply generated.',
        sessionId: json.sessionId || sessionId,
        sources: filterKnownTutorSources(Array.isArray(json.sources) ? json.sources : []),
      };
      if (normalized.sessionId) {
        sessionStorage.setItem(SESSION_KEY, normalized.sessionId);
      }
      if (options.onToken && normalized.reply) {
        options.onToken(normalized.reply);
      }
      return normalized;
    } catch (error) {
      if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        throw new Error('Request cancelled.');
      }

      if (error instanceof Error && error.message) {
        throw error;
      }

      throw new Error(
        messageFromHttpError(error, 'Could not reach the tutor. Try again.'),
      );
    } finally {
      cancelSub.unsubscribe();
      if (this.abortController === controller) {
        this.abortController = null;
      }
    }
  }

  private async readErrorReply(response: Response, sessionId: string): Promise<string> {
    try {
      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream')) {
        const text = await response.text();
        const reply = this.parseSseErrorReply(text);
        if (reply) {
          return reply;
        }
      } else {
        const payload = (await response.json()) as LearnChatResponse & { message?: string };
        if (typeof payload.reply === 'string' && payload.reply.trim()) {
          return payload.reply.trim();
        }
        if (typeof payload.message === 'string' && payload.message.trim()) {
          return payload.message.trim();
        }
      }
    } catch {
      // fall through
    }
    return `Could not reach the tutor (${response.status}). Try again.`;
  }

  /** Parse SSE error events, including multi-line `data:` payloads. */
  private parseSseErrorReply(text: string): string | null {
    for (const block of text.split('\n\n')) {
      if (!block.trim()) {
        continue;
      }
      const lines = block.split('\n');
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (event !== 'error' || dataLines.length === 0) {
        continue;
      }
      try {
        const parsed = JSON.parse(dataLines.join('\n')) as LearnChatResponse & { message?: string };
        if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
          return parsed.reply.trim();
        }
        if (typeof parsed.message === 'string' && parsed.message.trim()) {
          return parsed.message.trim();
        }
      } catch {
        // try next block
      }
    }
    return null;
  }

  private async consumeSse(
    body: ReadableStream<Uint8Array>,
    onToken: ((token: string) => void) | undefined,
    fallbackSessionId: string,
  ): Promise<LearnChatResponse> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let reply = '';
    let sessionId = fallbackSessionId;
    let sources: LearnChatSource[] = [];
    let sawDone = false;
    let errorReply: string | null = null;

    const handleBlock = (block: string): void => {
      const lines = block.split('\n');
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length === 0) {
        return;
      }
      const raw = dataLines.join('\n');
      let data: unknown;
      try {
        data = JSON.parse(raw) as unknown;
      } catch {
        return;
      }
      const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      if (event === 'token') {
        const text = typeof record['text'] === 'string' ? record['text'] : '';
        if (text) {
          reply += text;
          onToken?.(text);
        }
      } else if (event === 'done') {
        sawDone = true;
        if (typeof record['reply'] === 'string' && record['reply'].trim()) {
          reply = record['reply'].trim();
        }
        if (typeof record['sessionId'] === 'string' && record['sessionId'].trim()) {
          sessionId = record['sessionId'].trim();
        }
        if (Array.isArray(record['sources'])) {
          sources = record['sources'] as LearnChatSource[];
        }
      } else if (event === 'error') {
        errorReply =
          typeof record['reply'] === 'string' && record['reply'].trim()
            ? record['reply'].trim()
            : 'Could not reach the tutor. Try again.';
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const block of parts) {
        if (block.trim()) {
          handleBlock(block);
        }
      }
    }
    if (buffer.trim()) {
      handleBlock(buffer);
    }

    if (errorReply) {
      throw new Error(errorReply);
    }

    // Token-only streams without a done event are incomplete (abort/cut-off).
    if (!sawDone) {
      throw new Error('Could not reach the tutor. Try again.');
    }

    return {
      reply: reply.trim() || 'No reply generated.',
      sessionId,
      sources: filterKnownTutorSources(sources),
    };
  }
}
