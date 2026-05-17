import { Component, input, output } from '@angular/core';

import { Answer, RubricCriterion } from '../../models';

export interface RubricScoreChange {
  answerId: string;
  criterion: RubricCriterion;
  points: number;
}

@Component({
  selector: 'app-rubric-table',
  imports: [],
  templateUrl: './rubric-table.html',
  styleUrl: './rubric-table.css',
})
export class RubricTable {
  readonly criteria = input<RubricCriterion[]>([]);
  readonly answers = input<Answer[]>([]);
  readonly scoreChanged = output<RubricScoreChange>();

  protected scoreFor(answer: Answer, criterionId: string): number | null {
    const score = answer.scores.find((item) => item.criterionId === criterionId);

    return score?.points ?? null;
  }

  protected onScoreInput(answerId: string, criterion: RubricCriterion, event: Event): void {
    const input = event.target as HTMLInputElement;

    this.scoreChanged.emit({
      answerId,
      criterion,
      points: input.valueAsNumber,
    });
  }
}
