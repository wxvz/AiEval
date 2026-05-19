import { beforeEach, describe, expect, it, vi } from 'vitest';

const { chat } = vi.hoisted(() => ({
  chat: vi.fn(),
}));

vi.mock('./chat.js', () => ({ chat }));
vi.mock('./provider.js', () => ({
  resolveProvider: vi.fn().mockResolvedValue({
    providerName: 'groq',
    provider: { name: 'groq' },
    judgeModel: { model: 'judge-model', label: 'Judge' },
    answerModels: [],
  }),
}));

import { buildTitleGenerateUser, TITLE_GENERATE_SYSTEM } from './prompts.js';
import { generateEvaluationTitle, TITLE_GENERATION_TEMPERATURE } from './generate-title.js';

describe('buildTitleGenerateUser', () => {
  it('includes a rotating domain hint and unique request id', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValue(0.123456789);

    const content = buildTitleGenerateUser();

    expect(content).toContain('science and technology');
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
});
