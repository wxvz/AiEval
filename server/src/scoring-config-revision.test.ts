import { describe, expect, it } from 'vitest';

import { computeScoringConfigRevision } from './scoring-config-revision.js';
import { DEFAULT_EVALUATION_CONFIG } from './evaluation-config.js';

describe('computeScoringConfigRevision', () => {
  it('changes when judge strictness changes', () => {
    const base = {
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    };
    const criteria = [{ id: 'a', name: 'A', maxPoints: 5, weight: 1 }];
    const balanced = computeScoringConfigRevision(base, criteria);
    const hard = computeScoringConfigRevision(
      {
        ...base,
        evaluationConfig: {
          ...DEFAULT_EVALUATION_CONFIG,
          judgeProfile: { strictness: 'hard' },
        },
      },
      criteria,
    );

    expect(balanced).not.toBe(hard);
  });
});
