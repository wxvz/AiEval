import { describe, expect, it, vi } from 'vitest';

vi.mock('../llm/generate-title.js', () => ({
  generateEvaluationTitle: vi.fn().mockResolvedValue('Generated title'),
}));

vi.mock('../llm/generate-prompt.js', () => ({
  generateEvaluationPrompt: vi.fn().mockResolvedValue('Generated prompt for evaluation.'),
}));

const { generateEvaluationMetadata } = await import('./metadata.js');
const { generateEvaluationTitle } = await import('../llm/generate-title.js');
const { generateEvaluationPrompt } = await import('../llm/generate-prompt.js');

describe('generateEvaluationMetadata', () => {
  it('chains title generation then prompt generation', async () => {
    const result = await generateEvaluationMetadata();

    expect(generateEvaluationTitle).toHaveBeenCalled();
    expect(generateEvaluationPrompt).toHaveBeenCalledWith('Generated title', {});
    expect(result).toEqual({
      title: 'Generated title',
      prompt: 'Generated prompt for evaluation.',
    });
  });
});
