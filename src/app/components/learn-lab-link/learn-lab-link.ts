import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { resolveLearnSafeLink } from '../../learn/learn-lab-lock';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { SettingsService } from '../../services/settings.service';

/**
 * Curriculum-aware link: unlocked targets navigate normally; locked targets
 * send the learner to the first missing prerequisite (or Learn hub).
 */
@Component({
  selector: 'app-learn-lab-link',
  imports: [RouterLink],
  template: `
    <a
      [routerLink]="safe().route"
      [attr.title]="safe().title"
      [class.learn-lab-link--locked]="safe().locked"
    >
      <ng-content />
    </a>
  `,
})
export class LearnLabLink {
  private readonly progress = inject(LearnProgressService);
  private readonly settings = inject(SettingsService);

  /** Absolute Learn path, e.g. `/learn/labs/rag-playground`. */
  readonly route = input.required<string>();

  readonly safe = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    return resolveLearnSafeLink(
      this.route(),
      this.progress.completedIds(),
      this.settings.learnUnlockAll(),
    );
  });
}
