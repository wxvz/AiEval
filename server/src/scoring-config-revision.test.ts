import { describe, expect, it } from 'vitest';

import { computeScoringConfigRevision } from './scoring-config-revision.js';
import { DEFAULT_EVALUATION_CONFIG } from './evaluation-config.js';

describe('computeScoringConfigRevision', () => {
  const criteria = [{ id: 'a', name: 'A', description: 'Accurate', maxPoints: 5, weight: 1 }];

  function base(overrides: { prompt?: string; evaluationConfig?: typeof DEFAULT_EVALUATION_CONFIG } = {}) {
    return {
      prompt: overrides.prompt ?? 'Original prompt',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: overrides.evaluationConfig ?? DEFAULT_EVALUATION_CONFIG,
    };
  }

  it('changes when judge strictness changes', () => {
    const balanced = computeScoringConfigRevision(base(), criteria);
    const hard = computeScoringConfigRevision(
      base({
        evaluationConfig: {
          ...DEFAULT_EVALUATION_CONFIG,
          judgeProfile: { strictness: 'hard' },
        },
      }),
      criteria,
    );

    expect(balanced).not.toBe(hard);
  });

  it('changes when the evaluation prompt changes', () => {
    const original = computeScoringConfigRevision(base({ prompt: 'Prompt A' }), criteria);
    const revised = computeScoringConfigRevision(base({ prompt: 'Prompt B' }), criteria);

    expect(original).not.toBe(revised);
  });

  it('changes when criterion name or description changes', () => {
    const original = computeScoringConfigRevision(base(), criteria);
    const renamed = computeScoringConfigRevision(base(), [
      { ...criteria[0], name: 'Accuracy' },
    ]);
    const redacted = computeScoringConfigRevision(base(), [
      { ...criteria[0], description: 'Updated anchor' },
    ]);

    expect(original).not.toBe(renamed);
    expect(original).not.toBe(redacted);
  });
});
