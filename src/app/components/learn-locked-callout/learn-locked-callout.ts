import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { type LearnLessonMeta } from '../../learn/curriculum';
import {
  firstMissingPrerequisiteLesson,
  isLearnLabLocked,
} from '../../learn/learn-lab-lock';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-learn-locked-callout',
  imports: [RouterLink],
  template: `
    @if (locked()) {
      <div class="learn-callout learn-callout--muted mb-3" role="status">
        Complete earlier lessons in this track first.
        @if (prerequisiteLesson(); as prereq) {
          <a [routerLink]="prereq.route" class="learn-back-link ms-1">Start with {{ prereq.title }}.</a>
        }
      </div>
    }
    <div [class.learn-lab-body--locked]="locked()">
      <ng-content />
    </div>
  `,
})
export class LearnLockedCallout {
  private readonly progress = inject(LearnProgressService);
  private readonly settings = inject(SettingsService);

  readonly lesson = input<LearnLessonMeta | null | undefined>(null);

  readonly locked = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    return isLearnLabLocked(
      this.lesson(),
      this.progress.completedIds(),
      this.settings.learnUnlockAll(),
    );
  });

  readonly prerequisiteLesson = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    return firstMissingPrerequisiteLesson(
      this.lesson(),
      this.progress.completedIds(),
    );
  });
}
