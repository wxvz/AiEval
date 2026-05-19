import { describe, expect, it } from 'vitest';

import { formatProviderLabel } from './provider-choice-modal';

describe('formatProviderLabel', () => {
  it('formats huggingface as Hugging Face', () => {
    expect(formatProviderLabel('huggingface')).toBe('Hugging Face');
  });

  it('formats openrouter as OpenRouter', () => {
    expect(formatProviderLabel('openrouter')).toBe('OpenRouter');
  });

  it('title-cases unknown providers', () => {
    expect(formatProviderLabel('custom')).toBe('Custom');
  });
});
