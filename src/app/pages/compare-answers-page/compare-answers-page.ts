import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EmptyState } from '../../components/empty-state/empty-state';
import { RubricScoreChange, RubricTable } from '../../components/rubric-table/rubric-table';
import { ScoreSummary } from '../../components/score-summary/score-summary';
import { WinnerBadge } from '../../components/winner-badge/winner-badge';
import { computeScoreSummary, RubricCriterion, Score } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';

export function upsertCriterionScore(
  scores: Score[],
  criterion: RubricCriterion,
  points: number,
): Score[] {
  const clampedPoints = clampScore(points, criterion.maxPoints);
  const nextScore: Score = {
    criterionId: criterion.id,
    criterionName: criterion.name,
    points: clampedPoints,
    maxPoints: criterion.maxPoints,
  };
  const existingScore = scores.find((score) => score.criterionId === criterion.id);

  if (!existingScore) {
    return [...scores, nextScore];
  }

  return scores.map((score) =>
    score.criterionId === criterion.id
      ? {
          ...score,
          ...nextScore,
          ...(score.notes ? { notes: score.notes } : {}),
        }
      : score,
  );
}

function clampScore(points: number, maxPoints: number): number {
  if (!Number.isFinite(points)) {
    return 0;
  }

  return Math.min(Math.max(points, 0), maxPoints);
}

@Component({
  selector: 'app-compare-answers-page',
  imports: [RouterLink, RubricTable, ScoreSummary, WinnerBadge, EmptyState],
  templateUrl: './compare-answers-page.html',
  styleUrl: './compare-answers-page.css',
})
export class CompareAnswersPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));
  protected readonly activeCriteria = computed(() => {
    const current = this.evaluation();

    return current ? this.evaluationService.getActiveCriteria(current) : [];
  });

  protected summaryFor(answerId: string) {
    const answer = this.evaluation()?.answers.find((item) => item.id === answerId);

    return answer
      ? computeScoreSummary(this.activeScoresFor(answer.scores))
      : { totalPoints: 0, maxPoints: 0, percentage: 0 };
  }

  protected onScoreChanged(change: RubricScoreChange): void {
    const answer = this.evaluation()?.answers.find((item) => item.id === change.answerId);

    if (!answer) {
      return;
    }

    this.evaluationService.updateAnswer(this.evaluationId, answer.id, {
      scores: upsertCriterionScore(answer.scores, change.criterion, change.points),
    });
  }

  protected setWinner(answerId: string): void {
    this.evaluationService.setWinner(this.evaluationId, answerId);
  }

  private activeScoresFor(scores: Score[]): Score[] {
    const activeCriterionIds = new Set(this.activeCriteria().map((criterion) => criterion.id));

    return scores.filter((score) => activeCriterionIds.has(score.criterionId));
  }
}
