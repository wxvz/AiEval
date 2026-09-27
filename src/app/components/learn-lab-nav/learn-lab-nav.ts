import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  getAdjacentLessons,
  getLesson,
  getNavigableAdjacent,
  type LearnLessonMeta,
} from '../../learn/curriculum';
import { isLearnLabLocked, resolveLearnSafeLink } from '../../learn/learn-lab-lock';
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
    return isLearnLabLocked(
      this.lesson(),
      this.progress.completedIds(),
      this.settings.learnUnlockAll(),
    );
  });

  readonly markCompleteDisabled = computed(
    () => this.completed() || this.locked() || this.completionDisabled(),
  );

  readonly markCompleteTitle = computed(() => {
    if (this.completed()) {
      return 'Lab already completed';
    }
    if (this.locked()) {
      return 'Complete prerequisites first';
    }
    if (this.completionDisabled()) {
      return 'Finish the lab goal before marking complete';
    }
    return null;
  });

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

  readonly previousSafe = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    const previous = this.adjacent().previous;
    if (!previous) {
      return null;
    }
    const safe = resolveLearnSafeLink(
      previous.route,
      this.progress.completedIds(),
      this.settings.learnUnlockAll(),
    );
    return { label: previous.title, route: safe.route, hint: safe.title };
  });

  readonly nextSafe = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    const next = this.adjacent().next;
    if (!next) {
      return null;
    }
    const safe = resolveLearnSafeLink(
      next.route,
      this.progress.completedIds(),
      this.settings.learnUnlockAll(),
    );
    return { label: next.title, route: safe.route, hint: safe.title };
  });
}
