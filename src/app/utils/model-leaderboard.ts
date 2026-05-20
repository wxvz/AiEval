import { Evaluation } from '../models';

export interface ModelLeaderboardEntry {
  rank: number;
  label: string;
  winCount: number;
}

export function winnerLabelForEvaluation(evaluation: Evaluation): string | null {
  if (evaluation.winnerAnswerId) {
    const winner = evaluation.answers.find((answer) => answer.id === evaluation.winnerAnswerId);

    if (winner) {
      const label = winner.label.trim();

      return label.length > 0 ? label : null;
    }
  }

  const flagged = evaluation.answers.find((answer) => answer.isWinner);

  if (flagged) {
    const label = flagged.label.trim();

    return label.length > 0 ? label : null;
  }

  return null;
}

export function computeModelLeaderboard(
  evaluations: Evaluation[],
  limit = 3,
): ModelLeaderboardEntry[] {
  const counts = new Map<string, number>();

  for (const evaluation of evaluations) {
    const label = winnerLabelForEvaluation(evaluation);

    if (!label) {
      continue;
    }

    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort(([labelA, countA], [labelB, countB]) => {
    if (countB !== countA) {
      return countB - countA;
    }

    return labelA.localeCompare(labelB);
  });

  return sorted.slice(0, limit).map(([label, winCount], index) => ({
    rank: index + 1,
    label,
    winCount,
  }));
}
