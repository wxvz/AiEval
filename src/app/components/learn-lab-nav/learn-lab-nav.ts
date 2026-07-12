import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { getAdjacentLessons, getLesson, type LearnLessonMeta } from '../../learn/curriculum';

@Component({
  selector: 'app-learn-lab-nav',
  imports: [RouterLink],
  templateUrl: './learn-lab-nav.html',
  styleUrl: './learn-lab-nav.css',
})
export class LearnLabNav {
  readonly lesson = input<LearnLessonMeta | null | undefined>(null);
  readonly parent = input<LearnLessonMeta | null | undefined>(null);
  readonly completed = input(false);
  readonly completionDisabled = input(false);
  readonly complete = output<void>();

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

    const parent = this.resolvedParent();
    if (!parent) {
      return { previous: null, next: null };
    }
    const parentAdjacent = getAdjacentLessons(parent.id);
    return {
      previous: parentAdjacent.previous,
      next: parentAdjacent.next,
    };
  });
}
