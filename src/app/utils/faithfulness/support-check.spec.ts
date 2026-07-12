import { describe, expect, it } from 'vitest';

import {
  FAITHFULNESS_ANSWER,
  FAITHFULNESS_CONTEXT,
  classifyAnswerSupport,
  classifySentenceSupport,
} from './support-check';

describe('support-check', () => {
  it('marks sentences with strong overlap as supported', () => {
    const result = classifySentenceSupport('Plan Basic costs $9 per month.', FAITHFULNESS_CONTEXT);
    expect(result.label).toBe('supported');
  });

  it('marks invented details as unsupported', () => {
    const result = classifySentenceSupport(
      'We offer free lifetime warranties worldwide.',
      FAITHFULNESS_CONTEXT,
    );
    expect(result.label).toBe('unsupported');
  });

  it('splits multi-sentence answers', () => {
    const rows = classifyAnswerSupport(FAITHFULNESS_ANSWER, FAITHFULNESS_CONTEXT);
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.some((row) => row.label === 'unsupported')).toBe(true);
    expect(rows.some((row) => row.label === 'supported')).toBe(true);
  });
});
