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
import {
  buildPromptGenerateSystem,
  buildPromptGenerateUser,
  PROMPT_GENERATE_SYSTEM,
} from './prompts.js';
import { DEFAULT_EVALUATION_CONFIG } from '../evaluation-config.js';

describe('buildPromptGenerateUser', () => {
  it('keeps the title and adds a rotating challenge profile', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);

    const content = buildPromptGenerateUser('Grid resilience decision');

    expect(content).toContain('Grid resilience decision');
    expect(content).toContain(
      'Require a recommendation under competing constraints, with assumptions and trade-offs made explicit.',
    );
    expect(content).toContain('do not mention the profile or evaluation process');
    random.mockRestore();
  });

  it('adds mandatory answer requirements for coding and grounded configs', () => {
    const coding = buildPromptGenerateUser('Fix the queue worker', {
      ...DEFAULT_EVALUATION_CONFIG,
      goal: 'coding',
      responseConstraints: {
        format: 'freeform',
        requireCitations: false,
        requireCode: true,
        requireTests: true,
      },
    });
    const grounded = buildPromptGenerateUser('Verify the policy memo', {
      ...DEFAULT_EVALUATION_CONFIG,
      goal: 'grounded',
      responseConstraints: {
        format: 'freeform',
        requireCitations: true,
        requireCode: false,
        requireTests: false,
      },
    });

    expect(coding).toContain('Require working code in the answer.');
    expect(coding).toContain('Require tests or test cases');
    expect(grounded).toContain('Include labeled source excerpts');
  });
});

describe('buildPromptGenerateSystem', () => {
  it('embeds source citation rules for grounded configs', () => {
    const system = buildPromptGenerateSystem({
      ...DEFAULT_EVALUATION_CONFIG,
      goal: 'grounded',
      responseConstraints: {
        format: 'freeform',
        requireCitations: true,
        requireCode: false,
        requireTests: false,
      },
    });

    expect(system).toContain('embed 2–3 short, self-contained source excerpts');
  });

  it('requires code and tests in the system prompt for coding configs', () => {
    const system = buildPromptGenerateSystem({
      ...DEFAULT_EVALUATION_CONFIG,
      goal: 'coding',
      responseConstraints: {
        format: 'freeform',
        requireCitations: false,
        requireCode: true,
        requireTests: true,
      },
    });

    expect(system).toContain('concrete code implementation');
    expect(system).toContain('test cases or an automated test suite');
  });
});

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
    const messages = chat.mock.calls[0]![2] as { role: string; content: string }[];

    expect(messages[0]?.content).toBe(PROMPT_GENERATE_SYSTEM);
    expect(messages[1]?.content).toContain('Science explainer');
    expect(messages[1]?.content).toContain('Challenge profile for this request:');
  });

  it('throws when generated prompt is too short', async () => {
    chat.mockResolvedValue({ text: 'Hi' });

    await expect(generateEvaluationPrompt('Short')).rejects.toThrow(/too short/i);
  });
});
