import { describe, expect, it } from 'vitest';

import { stripModelArtifacts } from './sanitize-model-output.js';

describe('stripModelArtifacts', () => {
  it('removes redacted_thinking blocks', () => {
    const input =
      'Hello<think>internal reasoning</think> world';

    expect(stripModelArtifacts(input)).toBe('Hello world');
  });

  it('removes multiple blocks and trims', () => {
    const input =
      '  <think>a</think>Answer<think>b</think>  ';

    expect(stripModelArtifacts(input)).toBe('Answer');
  });
});
