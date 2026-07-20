import type { Server } from 'node:http';

import express from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { configMock } = vi.hoisted(() => ({
  configMock: {
    learnChatWebhookUrl: 'https://n8n.example/webhook/learn-chat',
  },
}));

vi.mock('../config.js', () => ({
  config: configMock,
}));

vi.mock('../logging/logger.js', () => ({
  logEvent: vi.fn(),
}));

import { createLearnChatRouter } from './learn-chat.js';

async function postLearnChat(
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const app = express();
  app.use(express.json());
  app.use('/api/learn-chat', createLearnChatRouter());

  const server = await new Promise<Server>((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Could not resolve test server port');
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/learn-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const responseBody = await response.json();

    return { status: response.status, body: responseBody };
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
    configMock.learnChatWebhookUrl = 'https://n8n.example/webhook/learn-chat';
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

  it('forwards to the webhook and normalizes the response', async () => {
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
        }),
      }),
    );
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
});
