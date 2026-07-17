import { describe, expect, it } from 'vitest';

import { DEFAULT_EVALUATION_CONFIG, normalizeEvaluationConfig, responseConstraintsForGoal } from './evaluation-config.js';

describe('responseConstraintsForGoal', () => {
  it('requires citations for grounded goals', () => {
    expect(responseConstraintsForGoal('grounded')).toEqual({
      format: 'freeform',
      requireCitations: true,
      requireCode: false,
      requireTests: false,
    });
  });

  it('requires code for coding goals and tests except on easy difficulty', () => {
    expect(responseConstraintsForGoal('coding', 'easy')).toEqual({
      format: 'freeform',
      requireCitations: false,
      requireCode: true,
      requireTests: false,
    });
    expect(responseConstraintsForGoal('coding', 'balanced')).toEqual({
      format: 'freeform',
      requireCitations: false,
      requireCode: true,
      requireTests: true,
    });
  });

  it('leaves other goals on default constraints', () => {
    expect(responseConstraintsForGoal('reasoning')).toEqual(
      DEFAULT_EVALUATION_CONFIG.responseConstraints,
    );
  });
});

describe('normalizeEvaluationConfig', () => {
  it('supplies balanced legacy defaults', () => {
    expect(normalizeEvaluationConfig(undefined)).toEqual(DEFAULT_EVALUATION_CONFIG);
  });

  it('sanitizes unknown values and keeps valid constraints', () => {
    expect(
      normalizeEvaluationConfig({
        taskDifficulty: 'impossible',
        goal: 'coding',
        audience: 'robot',
        responseConstraints: {
          maxWords: -4,
          format: 'json',
          requireCode: true,
          requireTests: 'yes',
        },
        expectedAnswer: '  reference facts  ',
        blindJudging: false,
        judgeProfile: { strictness: 'hard', model: ' judge-x ' },
      }),
    ).toEqual({
      taskDifficulty: 'balanced',
      goal: 'coding',
      audience: 'general',
      responseConstraints: {
        format: 'json',
        requireCitations: false,
        requireCode: true,
        requireTests: false,
      },
      expectedAnswer: 'reference facts',
      blindJudging: false,
      judgeProfile: { strictness: 'hard', model: 'judge-x' },
    });
  });
});
