import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EmptyState } from '../../components/empty-state/empty-state';
import { RubricTable } from '../../components/rubric-table/rubric-table';
import { ScoreSummary } from '../../components/score-summary/score-summary';
import { WinnerBadge } from '../../components/winner-badge/winner-badge';
import { computeScoreSummary } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';

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

    return answer ? computeScoreSummary(answer.scores) : { totalPoints: 0, maxPoints: 0, percentage: 0 };
  }

  protected setWinner(answerId: string): void {
    this.evaluationService.setWinner(this.evaluationId, answerId);
  }
}
