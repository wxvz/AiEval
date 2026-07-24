import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  getAdjacentLessons,
  getLesson,
  getNavigableAdjacent,
  isLessonLocked,
  type LearnLessonMeta,
} from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-learn-lab-nav',
  imports: [RouterLink],
  templateUrl: './learn-lab-nav.html',
  styleUrl: './learn-lab-nav.css',
})
export class LearnLabNav {
  private readonly progress = inject(LearnProgressService);
  private readonly settings = inject(SettingsService);

  readonly lesson = input<LearnLessonMeta | null | undefined>(null);
  readonly parent = input<LearnLessonMeta | null | undefined>(null);
  readonly completed = input(false);
  readonly completionDisabled = input(false);
  readonly complete = output<void>();

  readonly locked = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    const lesson = this.lesson();
    if (!lesson) {
      return false;
    }
    return isLessonLocked(lesson, this.progress.completedIds(), {
      ignorePrerequisites: this.settings.learnUnlockAll(),
    });
  });

  readonly markCompleteDisabled = computed(
    () => this.completed() || this.locked() || this.completionDisabled(),
  );

  readonly resolvedParent = computed(() => {
    const explicitParent = this.parent();
    if (explicitParent) {
      return explicitParent;
    }
    const parentId = this.lesson()?.parentLessonId;
    return parentId ? getLesson(parentId) ?? null : null;
  });

  readonly adjacent = computed(() => {
    const lesson = this.lesson();
    if (!lesson) {
      return { previous: null, next: null };
    }
    if (!lesson.optional) {
      return getAdjacentLessons(lesson.id);
    }
    return getNavigableAdjacent(lesson.id);
  });
}
