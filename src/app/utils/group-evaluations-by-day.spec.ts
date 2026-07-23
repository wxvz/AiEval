import { DEFAULT_EVALUATION_CONFIG, Evaluation } from '../models';

import { groupEvaluationsByDay, localDayKey } from './group-evaluations-by-day';

function evaluation(overrides: Partial<Evaluation> & Pick<Evaluation, 'id' | 'updatedAt'>): Evaluation {
  return {
    title: 'Test',
    prompt: 'Prompt',
    criteriaMode: 'default',
    criteria: [],
    evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    answers: [],
    createdAt: overrides.updatedAt,
    ...overrides,
  };
}

describe('localDayKey', () => {
  it('returns YYYY-MM-DD for a local calendar day', () => {
    const date = new Date(2024, 5, 15, 14, 30);
    expect(localDayKey(date.toISOString())).toBe('2024-06-15');
  });
});

describe('groupEvaluationsByDay', () => {
  it('returns an empty array when there are no evaluations', () => {
    expect(groupEvaluationsByDay([])).toEqual([]);
  });

  it('groups evaluations on the same updatedAt day', () => {
    const older = new Date(2024, 5, 15, 10, 0);
    const newer = new Date(2024, 5, 15, 18, 0);
    const first = evaluation({ id: '1', updatedAt: older.toISOString() });
    const second = evaluation({ id: '2', updatedAt: newer.toISOString() });

    const groups = groupEvaluationsByDay([first, second]);

    expect(groups).toHaveLength(1);
    expect(groups[0].dayKey).toBe('2024-06-15');
    expect(groups[0].evaluations).toEqual([first, second]);
  });

  it('sorts day groups newest first and preserves evaluation order within a day', () => {
    const dayA = new Date(2024, 5, 20, 12, 0);
    const dayB = new Date(2024, 5, 15, 12, 0);
    const firstOnDayA = evaluation({ id: '1', updatedAt: dayA.toISOString() });
    const secondOnDayA = evaluation({
      id: '2',
      updatedAt: new Date(2024, 5, 20, 9, 0).toISOString(),
    });
    const onDayB = evaluation({ id: '3', updatedAt: dayB.toISOString() });

    const groups = groupEvaluationsByDay([firstOnDayA, onDayB, secondOnDayA]);

    expect(groups.map((group) => group.dayKey)).toEqual(['2024-06-20', '2024-06-15']);
    expect(groups[0].evaluations).toEqual([firstOnDayA, secondOnDayA]);
    expect(groups[1].evaluations).toEqual([onDayB]);
  });

  it('formats a readable label for each day group', () => {
    const date = new Date(2024, 5, 15, 12, 0);
    const groups = groupEvaluationsByDay([
      evaluation({ id: '1', updatedAt: date.toISOString() }),
    ]);

    expect(groups[0].label).toContain('2024');
    expect(groups[0].label).toMatch(/Jun/i);
  });
});
