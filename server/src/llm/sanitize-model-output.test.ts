import { describe, expect, it } from 'vitest';

import {
  isSafetyClassifierOutput,
  isUnusableAnswerModel,
  stripModelArtifacts,
} from './sanitize-model-output.js';

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

  it('recovers the trailing answer from an unclosed think block', () => {
    const input = `<think>
I reason forever without closing the tag.

Cats are mammals.`;

    expect(stripModelArtifacts(input)).toBe('Cats are mammals.');
  });

  it('keeps text before an unclosed think block', () => {
    const input = 'Visible preface.<think>\ntruncated reasoning';

    expect(stripModelArtifacts(input)).toBe('Visible preface.');
  });

  it('returns empty when a closed think block has no answer after it', () => {
    const input = '<think>only internal reasoning</think>';

    expect(stripModelArtifacts(input)).toBe('');
  });

  it('removes thinking wrapper variants', () => {
    const input = '<thinking>scratch</thinking>\nFinal answer.';

    expect(stripModelArtifacts(input)).toBe('Final answer.');
  });

  it('rejects untagged self-correction verification dumps as empty', () => {
    const input = `All constraints met. Output matches exactly. Proceeds. Self-Correction/Verification during thought: - "Limit your answer to no more than three short paragraphs" -> Exactly 3. - "using clear language" -> Included $1.2M -> $1.6M. - edge case -> Covered in P3. All good. Output matches response.✅ Proceeds. Final check of the prompt: "Explain to the founder`;

    expect(stripModelArtifacts(input)).toBe('');
  });

  it('keeps normal answers that mention constraints in prose', () => {
    const input =
      'Opening a third center can cut delivery from 48 hours to about 30 hours, but fixed costs rise from $1.2M to $1.6M. That trade-off matters when demand spikes and routing grows complex.';

    expect(stripModelArtifacts(input)).toBe(input);
  });

  it('rejects content-safety classifier verdicts as empty', () => {
    expect(stripModelArtifacts('User Safety: safe')).toBe('');
    expect(
      stripModelArtifacts('User Safety: unsafe\nResponse Safety: unsafe\nSafety Categories: Violence'),
    ).toBe('');
  });

  it('keeps answers that mention safety without being classifier-only', () => {
    const input =
      'User safety matters here: refuse illegal instructions and offer a lawful alternative for the team.';

    expect(stripModelArtifacts(input)).toBe(input);
  });
});

describe('isSafetyClassifierOutput', () => {
  it('detects Nemotron-style verdict lines', () => {
    expect(isSafetyClassifierOutput('User Safety: safe')).toBe(true);
    expect(isSafetyClassifierOutput('User Safety: unsafe\nResponse Safety: safe')).toBe(true);
  });

  it('rejects ordinary prose', () => {
    expect(isSafetyClassifierOutput('Here is a revised four-week plan.')).toBe(false);
  });
});

describe('isUnusableAnswerModel', () => {
  it('flags content-safety and guard models', () => {
    expect(isUnusableAnswerModel('nvidia/nemotron-3.5-content-safety:free')).toBe(true);
    expect(isUnusableAnswerModel('meta-llama/Llama-Guard-3-8B')).toBe(true);
  });

  it('allows normal chat models', () => {
    expect(isUnusableAnswerModel('openai/gpt-oss-20b')).toBe(false);
    expect(isUnusableAnswerModel('meta-llama/llama-3.2-3b-instruct:free')).toBe(false);
  });
});
