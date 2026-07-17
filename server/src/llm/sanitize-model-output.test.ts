import { describe, expect, it } from 'vitest';

import { stripModelArtifacts } from './sanitize-model-output.js';

describe('stripModelArtifacts', () => {
  it('removes closed think blocks', () => {
    const input = 'Hello<think>internal reasoning</think> world';

    expect(stripModelArtifacts(input)).toBe('Hello world');
  });

  it('removes multiple blocks and trims', () => {
    const input = '  <think>a</think>Answer<think>b</think>  ';

    expect(stripModelArtifacts(input)).toBe('Answer');
  });

  it('keeps only the answer after a closed deep-thinking block', () => {
    const input = `<think>
I am reasoning about the question step by step.
</think>

Cats are mammals.`;

    expect(stripModelArtifacts(input)).toBe('Cats are mammals.');
  });

  it('drops unclosed think blocks through end of text', () => {
    const input = `<think>
I reason forever without closing the tag.

Cats are mammals.`;

    expect(stripModelArtifacts(input)).toBe('');
  });

  it('keeps text before an unclosed think block', () => {
    const input = 'Visible preface.<think>\ntruncated reasoning';

    expect(stripModelArtifacts(input)).toBe('Visible preface.');
  });

  it('removes thinking wrapper variants', () => {
    const input = '<thinking>scratch</thinking>\nFinal answer.';

    expect(stripModelArtifacts(input)).toBe('Final answer.');
  });
});
