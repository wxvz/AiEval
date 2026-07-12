import { describe, expect, it } from 'vitest';

import { JUDGE_OUTPUT_SAMPLES, parseJudgeOutput } from './parse-judge-scores';

describe('parse-judge-scores', () => {
  it('parses valid judge JSON', () => {
    const result = parseJudgeOutput(JUDGE_OUTPUT_SAMPLES[0]!.raw);
    expect(result.ok).toBe(true);
    expect(result.scores).toHaveLength(2);
    expect(result.scores[0]?.criterionId).toBe('c1');
    expect(result.scores[0]?.points).toBe(4);
  });

  it('strips markdown fences', () => {
    const result = parseJudgeOutput(JUDGE_OUTPUT_SAMPLES[1]!.raw);
    expect(result.ok).toBe(true);
    expect(result.scores[0]?.points).toBe(5);
  });

  it('rejects prose responses', () => {
    const result = parseJudgeOutput(JUDGE_OUTPUT_SAMPLES[2]!.raw);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Invalid JSON');
  });

  it('rejects trailing commas', () => {
    const result = parseJudgeOutput(JUDGE_OUTPUT_SAMPLES[3]!.raw);
    expect(result.ok).toBe(false);
  });
});
