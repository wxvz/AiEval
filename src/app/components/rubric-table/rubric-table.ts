import { Component, input } from '@angular/core';

import { Answer, RubricCriterion } from '../../models';

@Component({
  selector: 'app-rubric-table',
  imports: [],
  templateUrl: './rubric-table.html',
  styleUrl: './rubric-table.css',
})
export class RubricTable {
  readonly criteria = input<RubricCriterion[]>([]);
  readonly answers = input<Answer[]>([]);

  protected scoreFor(answer: Answer, criterionId: string): string {
    const score = answer.scores.find((item) => item.criterionId === criterionId);

    if (!score) {
      return '—';
    }

    return `${score.points}/${score.maxPoints}`;
  }
}
