import { Component, input, output } from '@angular/core';

import { Answer, computeScoreSummary, RubricCriterion } from '../../models';
import { ScoreSummary } from '../score-summary/score-summary';
import { WinnerBadge } from '../winner-badge/winner-badge';

@Component({
  selector: 'app-answer-card',
  imports: [ScoreSummary, WinnerBadge],
  templateUrl: './answer-card.html',
  styleUrl: './answer-card.css',
})
export class AnswerCard {
  readonly answer = input.required<Answer>();
  readonly criteria = input<RubricCriterion[]>([]);

  readonly removeRequested = output<string>();

  protected summary() {
    const activeCriterionIds = new Set(this.criteria().map((criterion) => criterion.id));
    const activeScores = this.answer().scores.filter((score) => activeCriterionIds.has(score.criterionId));

    return computeScoreSummary(activeScores);
  }
}
