import { Component, input } from '@angular/core';

import { ScoreSummary as ScoreSummaryModel } from '../../models';

@Component({
  selector: 'app-score-summary',
  imports: [],
  templateUrl: './score-summary.html',
  styleUrl: './score-summary.css',
})
export class ScoreSummary {
  readonly summary = input.required<ScoreSummaryModel>();
}
