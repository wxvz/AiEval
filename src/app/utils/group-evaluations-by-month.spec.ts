import { Evaluation } from '../models';

import { groupEvaluationsByMonth, monthKeyForDay } from './group-evaluations-by-month';

function evaluation(id: string, updatedAt: Date): Evaluation {
  return {
    id,
    title: `Evaluation ${id}`,
    prompt: 'Prompt',
    criteriaMode: 'default',
    criteria: [],
    answers: [],
    createdAt: updatedAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

describe('groupEvaluationsByMonth', () => {
  it('returns no month groups for an empty collection', () => {
    expect(groupEvaluationsByMonth([])).toEqual([]);
  });

  it('groups newest-first days under newest-first months', () => {
    const january = evaluation('jan', new Date(2025, 0, 31, 12));
    const februaryOlder = evaluation('feb-older', new Date(2025, 1, 2, 12));
    const februaryNewer = evaluation('feb-newer', new Date(2025, 1, 20, 12));

    const groups = groupEvaluationsByMonth([january, februaryOlder, februaryNewer]);

    expect(groups.map((group) => group.monthKey)).toEqual(['2025-02', '2025-01']);
    expect(groups[0].days.map((day) => day.dayKey)).toEqual(['2025-02-20', '2025-02-02']);
    expect(groups[0].days[0].evaluations).toEqual([februaryNewer]);
  });

  it('provides readable month and compact day labels', () => {
    const groups = groupEvaluationsByMonth([evaluation('one', new Date(2025, 5, 15, 12))]);

    expect(groups[0].label).toContain('2025');
    expect(groups[0].label).toMatch(/June/i);
    expect(groups[0].days[0].compactLabel).toMatch(/\b15\b/);
    expect(groups[0].days[0].compactLabel.length).toBeLessThan(groups[0].days[0].label.length);
  });
});

describe('monthKeyForDay', () => {
  it('returns the year and month portion of a day key', () => {
    expect(monthKeyForDay('2025-06-15')).toBe('2025-06');
  });
});
