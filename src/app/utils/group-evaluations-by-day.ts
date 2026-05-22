import { Evaluation } from '../models/evaluation.model';

export interface EvaluationDayGroup {
  dayKey: string;
  label: string;
  evaluations: Evaluation[];
}

/** Local calendar day as YYYY-MM-DD from an ISO timestamp. */
export function localDayKey(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function groupEvaluationsByDay(evaluations: Evaluation[]): EvaluationDayGroup[] {
  const byDay = new Map<string, Evaluation[]>();

  for (const evaluation of evaluations) {
    const key = localDayKey(evaluation.updatedAt);
    const bucket = byDay.get(key);

    if (bucket) {
      bucket.push(evaluation);
    } else {
      byDay.set(key, [evaluation]);
    }
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dayKey, dayEvaluations]) => ({
      dayKey,
      label: formatDayLabel(dayKey),
      evaluations: dayEvaluations,
    }));
}
