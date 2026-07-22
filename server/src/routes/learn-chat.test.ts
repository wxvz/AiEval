import type { Server } from 'node:http';

import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { configMock } = vi.hoisted(() => ({
  configMock: {
    learnChatWebhookUrl: 'https://n8n.example/webhook/learn-chat',
    learnChatWebhookSecret: 'test-secret',
    learnChatRateLimitPerMinute: 30,
  },
}));

vi.mock('../config.js', () => ({
  config: configMock,
}));

vi.mock('../logging/logger.js', () => ({
  logEvent: vi.fn(),
}));

import { logEvent } from '../logging/logger.js';
import { createLearnChatRouter, resetLearnChatRateLimitState } from './learn-chat.js';

async function postLearnChat(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: unknown; rawText?: string; contentType?: string }> {
  const app = express();
  app.use(express.json());
  app.use('/api/learn-chat', createLearnChatRouter());

  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });

  const address = server.address();

  if (!address || typeof address !== 'object') {
    throw new Error('Could not resolve test server port');
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/learn-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/event-stream')) {
      const rawText = await response.text();
      return { status: response.status, body: null, rawText, contentType };
    }
    const responseBody = await response.json();
    return { status: response.status, body: responseBody, contentType };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

const originalFetch = globalThis.fetch;

function stubWebhookFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('n8n.example/webhook/learn-chat')) {
      return handler(input, init);
    }
    return originalFetch(input, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('POST /api/learn-chat', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(logEvent).mockClear();
    resetLearnChatRateLimitState();
    configMock.learnChatWebhookUrl = 'https://n8n.example/webhook/learn-chat';
    configMock.learnChatWebhookSecret = 'test-secret';
    configMock.learnChatRateLimitPerMinute = 30;
  });

  it('returns 503 when webhook URL is not configured', async () => {
    configMock.learnChatWebhookUrl = '';

    const { status, body } = await postLearnChat({
      message: 'What is a dataset?',
      sessionId: 's1',
    });

    expect(status).toBe(503);
    expect(body).toEqual({
      message: 'Learn chat is not configured. Set LEARN_CHAT_WEBHOOK_URL.',
    });
  });

  it('returns 503 when webhook secret is missing', async () => {
    configMock.learnChatWebhookSecret = '';

    const { status, body } = await postLearnChat({
      message: 'What is a dataset?',
      sessionId: 's-secret',
    });

    expect(status).toBe(503);
    expect(body).toEqual({
      message:
        'Learn chat is not configured. Set LEARN_CHAT_WEBHOOK_SECRET (required with LEARN_CHAT_WEBHOOK_URL).',
    });
  });

  it('returns 400 for an empty message without calling the webhook', async () => {
    const fetchMock = stubWebhookFetch(async () => {
      throw new Error('webhook should not be called');
    });

    const { status, body } = await postLearnChat({
      message: '   ',
      sessionId: 's-fail',
    });

    expect(status).toBe(400);
    expect(body).toEqual({
      reply: 'Send a non-empty message.',
      sessionId: 's-fail',
      sources: [],
    });
    expect(
      fetchMock.mock.calls.some((call) => String(call[0]).includes('n8n.example')),
    ).toBe(false);
  });

  it('forwards the shared secret header to the webhook', async () => {
    const fetchMock = stubWebhookFetch(async () =>
      new Response(
        JSON.stringify({
          reply: 'A dataset is labeled rows.',
          sources: [{ title: 'What is a dataset?', route: '/learn/lessons/what-is-a-dataset' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { status, body } = await postLearnChat({
      message: 'What is a dataset?',
      sessionId: 's2',
      lessonId: 'what-is-a-dataset',
      lessonTitle: 'What is a dataset?',
      lessonSummary: 'Rows with labels.',
      route: '/learn/lessons/what-is-a-dataset',
      termHints: [],
      excerpts: [{ text: 'A dataset is labeled rows.', heading: 'Intro' }],
      sources: [{ title: 'What is a dataset?', route: '/learn/lessons/what-is-a-dataset' }],
    });

    expect(status).toBe(200);
    expect(body).toEqual({
      reply: 'A dataset is labeled rows.',
      sessionId: 's2',
      sources: [{ title: 'What is a dataset?', route: '/learn/lessons/what-is-a-dataset' }],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://n8n.example/webhook/learn-chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Learn-Chat-Secret': 'test-secret',
        }),
        body: JSON.stringify({
          action: 'chat',
          message: 'What is a dataset?',
          sessionId: 's2',
          lessonId: 'what-is-a-dataset',
          route: '/learn/lessons/what-is-a-dataset',
          lessonTitle: 'What is a dataset?',
          lessonSummary: 'Rows with labels.',
          termHints: [],
          excerpts: [{ text: 'A dataset is labeled rows.', heading: 'Intro' }],
          sources: [{ title: 'What is a dataset?', route: '/learn/lessons/what-is-a-dataset' }],
          curriculumCatalog: [],
        }),
      }),
    );
  });

  it('strips invented sources that are not in the curriculum catalog', async () => {
    stubWebhookFetch(async () =>
      new Response(
        JSON.stringify({
          reply: 'ok',
          sessionId: 's-catalog',
          sources: [
            { title: 'Bias control in AiEval', route: '/learn/lessons/fake' },
            { title: 'Bias and weights', route: '/learn/lessons/bias-and-weights' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { status, body } = await postLearnChat({
      message: 'What is bias?',
      sessionId: 's-catalog',
      curriculumCatalog: [
        { title: 'Bias and weights', route: '/learn/lessons/bias-and-weights' },
      ],
    });

    expect(status).toBe(200);
    expect(body).toEqual({
      reply: 'ok',
      sessionId: 's-catalog',
      sources: [{ title: 'Bias and weights', route: '/learn/lessons/bias-and-weights' }],
    });
  });

  it('forwards context sync without a message and returns ok', async () => {
    const fetchMock = stubWebhookFetch(async () =>
      new Response(JSON.stringify({ ok: true, sessionId: 's-ctx' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const termHints = [
      {
        term: 'bias',
        label: 'bias',
        sense: 'A learned offset after weighted inputs.',
      },
    ];

    const { status, body } = await postLearnChat({
      action: 'context',
      sessionId: 's-ctx',
      lessonId: 'bias-and-weights-lab',
      lessonTitle: 'Bias and weights lab',
      lessonSummary: 'Nudge weight and bias.',
      route: '/learn/labs/bias-and-weights',
      termHints,
    });

    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, sessionId: 's-ctx' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://n8n.example/webhook/learn-chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Learn-Chat-Secret': 'test-secret',
        }),
        body: JSON.stringify({
          action: 'context',
          sessionId: 's-ctx',
          lessonId: 'bias-and-weights-lab',
          route: '/learn/labs/bias-and-weights',
          lessonTitle: 'Bias and weights lab',
          lessonSummary: 'Nudge weight and bias.',
          termHints,
        }),
      }),
    );
  });

  it('maps empty upstream body to 502 with client sessionId', async () => {
    stubWebhookFetch(async () => new Response('', { status: 200 }));

    const { status, body } = await postLearnChat({
      message: 'Hello',
      sessionId: 's3',
    });

    expect(status).toBe(502);
    expect(body).toEqual({
      reply: 'The tutor returned an empty response. Try again.',
      sessionId: 's3',
      sources: [],
    });
  });

  it('maps upstream non-2xx to 502 with a stable LearnChatResponse body', async () => {
    stubWebhookFetch(async () =>
      new Response(
        JSON.stringify({
          reply: 'Send a non-empty message.',
          sessionId: 'upstream-session',
          sources: [{ title: 'x', route: '/learn' }],
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { status, body } = await postLearnChat({
      message: 'Hello',
      sessionId: 's4',
    });

    expect(status).toBe(502);
    expect(body).toEqual({
      reply: 'Send a non-empty message.',
      sessionId: 'upstream-session',
      sources: [],
    });
  });

  it('logs when termHints or excerpts are truncated by caps', async () => {
    stubWebhookFetch(async () =>
      new Response(JSON.stringify({ reply: 'ok', sessionId: 's-trunc', sources: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const longSense = 'x'.repeat(500);
    const termHints = Array.from({ length: 10 }, (_, index) => ({
      term: `t${index}`,
      label: `L${index}`,
      sense: longSense,
    }));
    const excerpts = Array.from({ length: 8 }, (_, index) => ({
      text: `excerpt ${index} ${'y'.repeat(700)}`,
      heading: `H${index}`,
    }));

    const { status } = await postLearnChat({
      message: 'Hello',
      sessionId: 's-trunc',
      termHints,
      excerpts,
    });

    expect(status).toBe(200);
    expect(logEvent).toHaveBeenCalledWith(
      'info',
      'learn_chat.truncated',
      expect.objectContaining({
        termHintsTruncated: true,
        excerptsTruncated: true,
      }),
    );
  });

  it('streams token and done SSE events when Accept requests event-stream', async () => {
    stubWebhookFetch(async () =>
      new Response(
        JSON.stringify({
          reply: 'Bias shifts the baseline for every input.',
          sessionId: 's-stream',
          sources: [{ title: 'Bias and weights', route: '/learn/lessons/bias-and-weights' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const { status, rawText, contentType } = await postLearnChat(
      { message: 'What is bias?', sessionId: 's-stream' },
      { Accept: 'text/event-stream' },
    );

    expect(status).toBe(200);
    expect(contentType).toContain('text/event-stream');
    expect(rawText).toContain('event: token');
    expect(rawText).toContain('event: done');
    expect(rawText).toContain('Bias shifts the baseline');
  });

  it('rate limits repeated requests from the same client IP', async () => {
    configMock.learnChatRateLimitPerMinute = 2;
    stubWebhookFetch(async () =>
      new Response(JSON.stringify({ reply: 'ok', sessionId: 's-rate', sources: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const first = await postLearnChat({ message: 'one', sessionId: 's-rate-unique' });
    const second = await postLearnChat({ message: 'two', sessionId: 's-rate-unique' });
    const third = await postLearnChat({ message: 'three', sessionId: 's-rate-unique' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.body).toEqual({
      reply: 'Too many requests. Try again shortly.',
      sessionId: 's-rate-unique',
      sources: [],
    });
  });

  it('aborts the n8n fetch when the client disconnects', async () => {
    let webhookSignal: AbortSignal | undefined;
    stubWebhookFetch(async (_input, init) => {
      webhookSignal = init?.signal;
      return new Promise<Response>(() => {
        // Never resolve — client abort should cancel this wait.
      });
    });

    const app = express();
    app.use(express.json());
    app.use('/api/learn-chat', createLearnChatRouter());

    const server = await new Promise<Server>((resolve) => {
      const started = app.listen(0, () => resolve(started));
    });
    const address = server.address();
    if (!address || typeof address !== 'object') {
      throw new Error('Could not resolve test server port');
    }

    const controller = new AbortController();
    try {
      const pending = fetch(`http://127.0.0.1:${address.port}/api/learn-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'hang', sessionId: 's-abort' }),
        signal: controller.signal,
      });

      await vi.waitFor(() => {
        expect(webhookSignal).toBeDefined();
      });

      controller.abort();
      await expect(pending).rejects.toThrow();
      await vi.waitFor(() => {
        expect(webhookSignal?.aborted).toBe(true);
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
