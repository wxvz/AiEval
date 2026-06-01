import { describe, expect, it, vi } from 'vitest';

import type { ResolvedLlmSetup } from '../llm/types.js';
import type { ModelFallbackHandlers } from './resilient-llm.js';

vi.mock('../llm/generate-title.js', () => ({
  generateEvaluationTitle: vi.fn().mockResolvedValue('Generated title'),
}));

vi.mock('../llm/generate-prompt.js', () => ({
  generateEvaluationPrompt: vi.fn().mockResolvedValue('Generated prompt for evaluation.'),
}));

const { generateEvaluationMetadata } = await import('./metadata.js');
const { generateEvaluationTitle } = await import('../llm/generate-title.js');
const { generateEvaluationPrompt } = await import('../llm/generate-prompt.js');

const setup = {
  providerName: 'groq',
  provider: { name: 'groq', complete: vi.fn() },
  answerModels: [],
  judgeModel: { model: 'judge-model', label: 'Judge' },
} as ResolvedLlmSetup;

const handlers: ModelFallbackHandlers = {};

describe('generateEvaluationMetadata', () => {
  it('chains title generation then prompt generation with fallback options', async () => {
    const extraContext = { runId: 'run-1', evaluationId: 'eval-1' };
    const result = await generateEvaluationMetadata(setup, handlers, extraContext);

    expect(generateEvaluationTitle).toHaveBeenCalledWith(extraContext, { setup, handlers });
    expect(generateEvaluationPrompt).toHaveBeenCalledWith('Generated title', extraContext, {
      setup,
      handlers,
    });
    expect(result).toEqual({
      title: 'Generated title',
      prompt: 'Generated prompt for evaluation.',
    });
  });
});
