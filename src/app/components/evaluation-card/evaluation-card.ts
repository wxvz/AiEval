import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Evaluation } from '../../models';
import { TokenUsageBadge } from '../token-usage-badge/token-usage-badge';

@Component({
  selector: 'app-evaluation-card',
  imports: [RouterLink, TokenUsageBadge],
  templateUrl: './evaluation-card.html',
  styleUrl: './evaluation-card.css',
})
export class EvaluationCard {
  readonly evaluation = input.required<Evaluation>();

  readonly deleteRequested = output<string>();
}
