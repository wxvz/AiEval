import { Component, input, output } from '@angular/core';

import { RubricCriterion } from '../../models';

@Component({
  selector: 'app-criterion-card',
  imports: [],
  templateUrl: './criterion-card.html',
  styleUrl: './criterion-card.css',
})
export class CriterionCard {
  readonly criterion = input.required<RubricCriterion>();

  readonly removeRequested = output<string>();
}
