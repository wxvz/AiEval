import { beforeEach, describe, expect, it, vi } from 'vitest';

const { chat } = vi.hoisted(() => ({
  chat: vi.fn(),
}));

const { chatWithModelFallback } = vi.hoisted(() => ({
  chatWithModelFallback: vi.fn(),
}));

vi.mock('./chat.js', () => ({ chat }));
vi.mock('../automation/resilient-llm.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../automation/resilient-llm.js')>();
  return { ...actual, chatWithModelFallback };
});
vi.mock('./provider.js', () => ({
  resolveProvider: vi.fn().mockResolvedValue({
    providerName: 'groq',
    provider: { name: 'groq' },
    judgeModel: { model: 'judge-model', label: 'Judge' },
    answerModels: [],
    preset: 'balanced',
  }),
}));

import { buildTitleGenerateUser, TITLE_GENERATE_SYSTEM } from './prompts.js';
import { generateEvaluationTitle, TITLE_GENERATION_TEMPERATURE } from './generate-title.js';
import type { ResolvedLlmSetup } from './types.js';

describe('buildTitleGenerateUser', () => {
  it('combines rotating domain, task, and challenge hints with a unique request id', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValue(0.123456789);

    const content = buildTitleGenerateUser();

    expect(content).toContain('distributed systems and reliability engineering');
    expect(content).toContain('a decision memo that must commit to a justified recommendation');
    expect(content).toContain('conflicting objectives and explicit trade-offs');
    expect(content).toMatch(/Request id: [a-z0-9]+-[a-z0-9]+/i);
  });
});

describe('generateEvaluationTitle', () => {
  beforeEach(() => {
    chat.mockReset();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('returns stripped title text from chat with varied user prompt and higher temperature', async () => {
    chat.mockResolvedValue({
      text: '  Comparing trade-offs in remote work policies  ',
    });

    const title = await generateEvaluationTitle();

    expect(title).toBe('Comparing trade-offs in remote work policies');
    expect(chat).toHaveBeenCalledOnce();
    const messages = chat.mock.calls[0]![2] as { role: string; content: string }[];
    const context = chat.mock.calls[0]![3] as { temperature?: number };

    expect(messages[0]?.content).toBe(TITLE_GENERATE_SYSTEM);
    expect(messages[1]?.content).toContain('Generate an evaluation title.');
    expect(messages[1]?.content).toMatch(/Request id:/);
    expect(messages[1]?.content).not.toBe('Generate an evaluation title.');
    expect(context.temperature).toBe(TITLE_GENERATION_TEMPERATURE);
  });

  it('throws when generated title is too short', async () => {
    chat.mockResolvedValue({ text: 'Hi' });

    await expect(generateEvaluationTitle()).rejects.toThrow(/too short/i);
  });

  it('uses chatWithModelFallback when automation options are provided', async () => {
    chatWithModelFallback.mockResolvedValue({
      text: '  Fallback-generated title  ',
    });

    const automationSetup = {
      providerName: 'groq',
      provider: { name: 'groq', complete: vi.fn() },
      judgeModel: { model: 'judge-model', label: 'Judge' },
      answerModels: [],
      preset: 'balanced',
    } as ResolvedLlmSetup;
    const handlers = { onModelFallback: vi.fn() };

    const title = await generateEvaluationTitle(
      { runId: 'run-1', evaluationId: 'eval-1' },
      { setup: automationSetup, handlers },
    );

    expect(title).toBe('Fallback-generated title');
    expect(chatWithModelFallback).toHaveBeenCalledOnce();
    expect(chat).not.toHaveBeenCalled();
    expect(chatWithModelFallback).toHaveBeenCalledWith(
      automationSetup,
      'judge',
      0,
      handlers,
      expect.arrayContaining([
        expect.objectContaining({ content: TITLE_GENERATE_SYSTEM }),
        expect.objectContaining({ content: expect.stringContaining('Generate an evaluation title.') }),
      ]),
      expect.objectContaining({
        runId: 'run-1',
        evaluationId: 'eval-1',
        temperature: TITLE_GENERATION_TEMPERATURE,
      }),
    );
  });
});
