import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnChatService } from './learn-chat.service';

function sseResponse(events: string[], init: ResponseInit = { status: 200 }): Response {
  const body = events.join('');
  return new Response(body, {
    ...init,
    headers: {
      'Content-Type': 'text/event-stream',
      ...(init.headers ?? {}),
    },
  });
}

describe('LearnChatService', () => {
  let service: LearnChatService;
  let http: HttpTestingController;
  let routerStub: { url: string };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    routerStub = { url: '/learn' };
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerStub },
        LearnChatService,
      ],
    });
    service = TestBed.inject(LearnChatService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it('reuses sessionId from sessionStorage', () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 'fixed-session');
    expect(service.getSessionId()).toBe('fixed-session');
    expect(service.getSessionId()).toBe('fixed-session');
  });

  it('derives lesson grounding from lesson and lab routes', () => {
    routerStub.url = '/learn/lessons/what-is-a-dataset';
    const dataset = service.contextFromRouter();
    expect(dataset.lessonId).toBe('what-is-a-dataset');
    expect(dataset.lessonTitle).toBe('What is a dataset?');
    expect(dataset.lessonSummary).toBeTruthy();
    expect(dataset.route).toBe('/learn/lessons/what-is-a-dataset');

    routerStub.url = '/learn/labs/semantic-memory';
    const lab = service.contextFromRouter();
    expect(lab.lessonId).toBe('semantic-memory-lab');
    expect(lab.lessonTitle).toBe('Semantic memory practice');
    expect(lab.termHints.map((hint) => hint.term)).toEqual([
      'semanticMemory',
      'retrieval',
      'embedding',
    ]);

    routerStub.url = '/learn';
    expect(service.contextFromRouter()).toEqual({
      lessonId: null,
      lessonTitle: null,
      lessonSummary: null,
      termHints: [],
      route: '/learn',
    });
  });

  it('posts chat turns with grounding, termHints, and excerpts via SSE', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's1');
    routerStub.url = '/learn/lessons/bias-and-weights';

    fetchMock.mockResolvedValue(
      sseResponse([
        'event: token\ndata: {"text":"Bias is a shared baseline shift."}\n\n',
        'event: done\ndata: {"reply":"Bias is a shared baseline shift.","sessionId":"s1","sources":[{"title":"Bias and weights","route":"/learn/lessons/bias-and-weights"}]}\n\n',
      ]),
    );

    const tokens: string[] = [];
    const pending = service.ask('What does bias control?', {
      onToken: (token) => tokens.push(token),
    });

    await expect(pending).resolves.toEqual({
      reply: 'Bias is a shared baseline shift.',
      sessionId: 's1',
      sources: [{ title: 'Bias and weights', route: '/learn/lessons/bias-and-weights' }],
    });
    expect(tokens.join('')).toContain('Bias is a shared baseline shift.');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/learn-chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
        }),
      }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as {
      action: string;
      message: string;
      lessonId: string;
      termHints: { term: string }[];
      excerpts: unknown[];
      sources: { route: string }[];
      curriculumCatalog?: { title: string }[];
      stream: boolean;
    };
    expect(body.action).toBe('chat');
    expect(body.message).toBe('What does bias control?');
    expect(body.lessonId).toBe('bias-and-weights');
    expect(body.termHints[0]?.term).toBe('bias');
    expect(body.excerpts.length).toBeGreaterThan(0);
    expect(body.sources[0]?.route).toBe('/learn/lessons/bias-and-weights');
    expect(body.curriculumCatalog?.some((entry) => entry.title === 'Bias and weights')).toBe(
      true,
    );
    expect(body.stream).toBe(true);
  });

  it('cross-grounds bias questions on the RAG lab with catalog + related termHints', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-rag');
    routerStub.url = '/learn/labs/rag-playground';

    fetchMock.mockResolvedValue(
      sseResponse([
        'event: done\ndata: {"reply":"Bias is a shared baseline.","sessionId":"s-rag","sources":[{"title":"Bias and weights","route":"/learn/lessons/bias-and-weights"}]}\n\n',
      ]),
    );

    await service.ask('how does bias control work');

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}')) as {
      lessonId: string;
      termHints: { term: string }[];
      excerpts: unknown[];
      sources: { title: string; route: string }[];
      curriculumCatalog: { title: string }[];
    };
    expect(body.lessonId).toBe('rag-playground-lab');
    expect(body.termHints[0]?.term).toBe('bias');
    expect(body.excerpts.length).toBeGreaterThan(0);
    expect(body.sources[0]?.title).toBe('Bias and weights');
    expect(body.curriculumCatalog.some((entry) => entry.title === 'Bias and weights')).toBe(true);
  });

  it('drops invented source titles from the SSE done event', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-fake');
    routerStub.url = '/learn/lessons/bias-and-weights';

    fetchMock.mockResolvedValue(
      sseResponse([
        'event: done\ndata: {"reply":"ok","sessionId":"s-fake","sources":[{"title":"Bias control in AiEval","route":"/learn/lessons/fake"}]}\n\n',
      ]),
    );

    await expect(service.ask('What is bias?')).resolves.toEqual({
      reply: 'ok',
      sessionId: 's-fake',
      sources: [],
    });
  });

  it('syncs page context with summary and termHints', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-ctx');
    routerStub.url = '/learn/labs/semantic-memory';

    const pending = service.syncContext();
    const req = http.expectOne('/api/learn-chat');
    expect(req.request.body.action).toBe('context');
    expect(req.request.body.sessionId).toBe('s-ctx');
    expect(req.request.body.lessonId).toBe('semantic-memory-lab');
    expect(req.request.body.lessonTitle).toBe('Semantic memory practice');
    expect(req.request.body.termHints.map((hint: { term: string }) => hint.term)).toEqual([
      'semanticMemory',
      'retrieval',
      'embedding',
    ]);
    expect(req.request.body.excerpts).toBeUndefined();
    req.flush({ ok: true, sessionId: 's-ctx' });
    await pending;
    expect(service.lastSyncOk).toBe(true);

    await service.syncContext();
    http.expectNone('/api/learn-chat');
  });

  it('cancels an in-flight context sync without marking lastSyncOk', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-cancel');
    routerStub.url = '/learn/lessons/bias-and-weights';

    const pending = service.syncContext();
    http.expectOne('/api/learn-chat');
    service.cancel();
    await pending;
    expect(service.lastSyncOk).toBeNull();

    // After cancel, a new sync for the same key should still be attempted.
    const retry = service.syncContext();
    const req = http.expectOne('/api/learn-chat');
    req.flush({ ok: true, sessionId: 's-cancel' });
    await retry;
    expect(service.lastSyncOk).toBe(true);
  });

  it('returns a local validation reply without calling the API', async () => {
    const result = await service.ask('   ');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.reply).toBe('Send a non-empty message.');
    expect(result.sources).toEqual([]);
  });

  it('throws API error replies instead of returning them as success', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-err');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          reply: 'The tutor timed out. Try a shorter question.',
          sessionId: 's-err',
          sources: [],
        }),
        { status: 504, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(service.ask('Hello')).rejects.toThrow(
      'The tutor timed out. Try a shorter question.',
    );
  });

  it('treats token-only SSE without done as an error', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-incomplete');
    fetchMock.mockResolvedValue(
      sseResponse(['event: token\ndata: {"text":"Partial reply"}\n\n']),
    );

    await expect(service.ask('Hello')).rejects.toThrow('Could not reach the tutor. Try again.');
  });

  it('parses multi-line SSE error data payloads', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-multiline');
    fetchMock.mockResolvedValue(
      new Response(
        [
          'event: error\n',
          'data: {"reply":"Too many requests.",\n',
          'data: "sessionId":"s-multiline","sources":[]}\n\n',
        ].join(''),
        { status: 429, headers: { 'Content-Type': 'text/event-stream' } },
      ),
    );

    await expect(service.ask('Hello')).rejects.toThrow('Too many requests.');
  });

  it('does not mark lastSyncedKey from ask so context sync still runs', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-ask-key');
    routerStub.url = '/learn/lessons/bias-and-weights';

    fetchMock.mockResolvedValue(
      sseResponse([
        'event: done\ndata: {"reply":"ok","sessionId":"s-ask-key","sources":[]}\n\n',
      ]),
    );
    await service.ask('What is bias?');

    const pending = service.syncContext();
    const req = http.expectOne('/api/learn-chat');
    expect(req.request.body.action).toBe('context');
    req.flush({ ok: true, sessionId: 's-ask-key' });
    await pending;
    expect(service.lastSyncOk).toBe(true);
  });

  it('surfaces an API token Settings hint on 401', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-401');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(service.ask('hello')).rejects.toThrow(/API token in Settings/i);
  });
});
