import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Evaluation } from '../../models';

@Component({
  selector: 'app-evaluation-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './evaluation-card.html',
  styleUrl: './evaluation-card.css',
})
export class EvaluationCard {
  readonly evaluation = input.required<Evaluation>();

  readonly deleteRequested = output<string>();
}
