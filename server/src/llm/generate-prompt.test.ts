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

import { generateEvaluationPrompt } from './generate-prompt.js';

describe('generateEvaluationPrompt', () => {
  beforeEach(() => {
    chat.mockReset();
  });

  it('returns stripped prompt text from chat', async () => {
    chat.mockResolvedValue({
      text: '  Explain how photosynthesis works to a middle-school student.  ',
    });

    const prompt = await generateEvaluationPrompt('Science explainer');

    expect(prompt).toContain('photosynthesis');
    expect(chat).toHaveBeenCalledOnce();
  });

  it('throws when generated prompt is too short', async () => {
    chat.mockResolvedValue({ text: 'Hi' });

    await expect(generateEvaluationPrompt('Short')).rejects.toThrow(/too short/i);
  });
});
