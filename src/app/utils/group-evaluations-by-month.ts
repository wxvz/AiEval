import { Evaluation } from '../models';

import { EvaluationDayGroup, groupEvaluationsByDay } from './group-evaluations-by-day';

export interface EvaluationMonthDayGroup extends EvaluationDayGroup {
  compactLabel: string;
}

export interface EvaluationMonthGroup {
  monthKey: string;
  label: string;
  days: EvaluationMonthDayGroup[];
}

function dateFromKey(key: string): Date {
  const [year, month, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function monthKeyForDay(dayKey: string): string {
  return dayKey.slice(0, 7);
}

function formatMonthLabel(monthKey: string): string {
  return dateFromKey(monthKey).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function formatCompactDayLabel(dayKey: string): string {
  return dateFromKey(dayKey).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
  });
}

export function groupEvaluationsByMonth(evaluations: Evaluation[]): EvaluationMonthGroup[] {
  const months = new Map<string, EvaluationMonthDayGroup[]>();

  for (const day of groupEvaluationsByDay(evaluations)) {
    const monthKey = monthKeyForDay(day.dayKey);
    const compactDay = { ...day, compactLabel: formatCompactDayLabel(day.dayKey) };
    const days = months.get(monthKey);

    if (days) {
      days.push(compactDay);
    } else {
      months.set(monthKey, [compactDay]);
    }
  }

  return [...months.entries()].map(([monthKey, days]) => ({
    monthKey,
    label: formatMonthLabel(monthKey),
    days,
  }));
}
