import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EmptyError, Subject, firstValueFrom, takeUntil } from 'rxjs';

import {
  getTutorExcerpts,
  getTutorPageGrounding,
  type TutorExcerpt,
  type TutorTermHint,
} from '../learn/learn-tutor-grounding';
import { messageFromHttpError } from './http-error-message';

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
}

export interface LearnChatResponse {
  reply: string;
  sessionId: string;
  sources: LearnChatSource[];
}

@Injectable({
  providedIn: 'root',
})
export class LearnChatService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

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
    const route = this.router.url.split('?')[0] || '/learn';
    let lessonId: string | null = null;

    const lessonMatch = /^\/learn\/lessons\/([^/]+)/.exec(route);
    if (lessonMatch) {
      lessonId = decodeURIComponent(lessonMatch[1]);
    } else {
      const labMatch = /^\/learn\/labs\/([^/]+)/.exec(route);
      if (labMatch) {
        lessonId = `${decodeURIComponent(labMatch[1])}-lab`;
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

  private readonly cancelInflight$ = new Subject<void>();
  private lastSyncedKey: string | null = null;

  /** Cancel any in-flight tutor request (e.g. panel closed). */
  cancel(): void {
    this.cancelInflight$.next();
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

    try {
      const response = await firstValueFrom(
        this.http.post<{ ok?: boolean; sessionId?: string }>(API, body),
      );
      if (response.sessionId) {
        sessionStorage.setItem(SESSION_KEY, response.sessionId);
      }
      this.lastSyncedKey = key;
    } catch {
      // Silent sync must not surface in the chat UI.
    }
  }

  async ask(message: string): Promise<LearnChatResponse> {
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

    const { excerpts, sources } = getTutorExcerpts(ctx.lessonId, trimmed);

    const body: LearnChatRequest = {
      action: 'chat',
      message: trimmed,
      sessionId,
      lessonId: ctx.lessonId,
      lessonTitle: ctx.lessonTitle,
      lessonSummary: ctx.lessonSummary,
      termHints: ctx.termHints,
      route: ctx.route,
      excerpts,
      sources,
    };

    // Drop any prior in-flight ask before starting a new one.
    this.cancelInflight$.next();

    try {
      const response = await firstValueFrom(
        this.http.post<LearnChatResponse>(API, body).pipe(takeUntil(this.cancelInflight$)),
      );
      if (response.sessionId) {
        sessionStorage.setItem(SESSION_KEY, response.sessionId);
      }
      this.lastSyncedKey = this.groundingSyncKey(response.sessionId || sessionId, ctx);
      return {
        reply: response.reply?.trim() || 'No reply generated.',
        sessionId: response.sessionId || sessionId,
        sources: Array.isArray(response.sources) ? response.sources : [],
      };
    } catch (error) {
      if (error instanceof EmptyError) {
        throw new Error('Request cancelled.');
      }

      const fromBody = (error as { error?: LearnChatResponse })?.error;
      if (fromBody && typeof fromBody.reply === 'string' && fromBody.reply.trim()) {
        // Surface API error replies as failures (not assistant success bubbles).
        throw new Error(fromBody.reply.trim());
      }

      throw new Error(
        messageFromHttpError(error, 'Could not reach the tutor. Try again.'),
      );
    }
  }
}
