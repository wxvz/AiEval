import { Component, input, output } from '@angular/core';

import { Answer, computeScoreSummary } from '../../models';
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

  readonly removeRequested = output<string>();

  protected summary() {
    return computeScoreSummary(this.answer().scores);
  }
}
