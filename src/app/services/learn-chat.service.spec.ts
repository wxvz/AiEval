import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LearnChatService } from './learn-chat.service';

describe('LearnChatService', () => {
  let service: LearnChatService;
  let http: HttpTestingController;
  let routerStub: { url: string };

  beforeEach(() => {
    sessionStorage.clear();
    routerStub = { url: '/learn' };
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

  it('posts chat turns with grounding, termHints, and excerpts', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's1');
    routerStub.url = '/learn/lessons/bias-and-weights';

    const pending = service.ask('What does bias control?');
    const req = http.expectOne('/api/learn-chat');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.action).toBe('chat');
    expect(req.request.body.message).toBe('What does bias control?');
    expect(req.request.body.sessionId).toBe('s1');
    expect(req.request.body.lessonId).toBe('bias-and-weights');
    expect(req.request.body.lessonTitle).toBe('Bias and weights');
    expect(req.request.body.lessonSummary).toBeTruthy();
    expect(req.request.body.termHints[0].term).toBe('bias');
    expect(req.request.body.excerpts.length).toBeGreaterThan(0);
    expect(req.request.body.sources[0].route).toBe('/learn/lessons/bias-and-weights');
    req.flush({
      reply: 'Bias is a shared baseline shift.',
      sessionId: 's1',
      sources: [{ title: 'Bias and weights', route: '/learn/lessons/bias-and-weights' }],
    });

    await expect(pending).resolves.toEqual({
      reply: 'Bias is a shared baseline shift.',
      sessionId: 's1',
      sources: [{ title: 'Bias and weights', route: '/learn/lessons/bias-and-weights' }],
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

    await service.syncContext();
    http.expectNone('/api/learn-chat');
  });

  it('returns a local validation reply without calling the API', async () => {
    const result = await service.ask('   ');
    http.expectNone('/api/learn-chat');
    expect(result.reply).toBe('Send a non-empty message.');
    expect(result.sources).toEqual([]);
  });

  it('throws API error replies instead of returning them as success', async () => {
    sessionStorage.setItem('aieval-learn-chat-session-id', 's-err');
    const pending = service.ask('Hello');
    const req = http.expectOne('/api/learn-chat');
    req.flush(
      { reply: 'The tutor timed out. Try a shorter question.', sessionId: 's-err', sources: [] },
      { status: 504, statusText: 'Gateway Timeout' },
    );
    await expect(pending).rejects.toThrow('The tutor timed out. Try a shorter question.');
  });
});
