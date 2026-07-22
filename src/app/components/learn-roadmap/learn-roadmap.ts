import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { getLiveLessons, getNextLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';

@Component({
  selector: 'app-learn-roadmap',
  imports: [RouterLink],
  templateUrl: './learn-roadmap.html',
  styleUrl: './learn-roadmap.css',
})
export class LearnRoadmap {
  private readonly progress = inject(LearnProgressService);

  readonly liveLessons = getLiveLessons();
  readonly completedCount = computed(() => {
    const completed = this.progress.completedIds();
    return this.liveLessons.filter((lesson) => completed.has(lesson.id)).length;
  });
  readonly totalCount = this.liveLessons.length;
  readonly nextLesson = computed(() => getNextLesson(this.progress.completedIds()));
  readonly allComplete = computed(() => this.completedCount() >= this.totalCount);

  progressPercent(): number {
    if (this.totalCount === 0) {
      return 0;
    }
    return Math.round((this.completedCount() / this.totalCount) * 100);
  }
}
