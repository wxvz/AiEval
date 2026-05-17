import { Component, input } from '@angular/core';

@Component({
  selector: 'app-winner-badge',
  imports: [],
  templateUrl: './winner-badge.html',
  styleUrl: './winner-badge.css',
})
export class WinnerBadge {
  readonly label = input('Winner');
}
