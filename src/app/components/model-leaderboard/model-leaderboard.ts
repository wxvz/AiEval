import { Component, input } from '@angular/core';

import { ModelLeaderboardEntry } from '../../utils/model-leaderboard';

@Component({
  selector: 'app-model-leaderboard',
  imports: [],
  templateUrl: './model-leaderboard.html',
  styleUrl: './model-leaderboard.css',
})
export class ModelLeaderboard {
  readonly entries = input<ModelLeaderboardEntry[]>([]);
}
