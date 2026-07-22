import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson, getLessonsForTrack, getTrack } from '../../learn/curriculum';
import { loadWalkthroughContent } from '../../learn/learn-content';
import { LearnProgressService } from '../../learn/learn-progress.service';

@Component({
  selector: 'app-learn-walkthrough-page',
  imports: [RouterLink, LearnLabNav, PageShell],
  templateUrl: './learn-walkthrough-page.html',
  styleUrl: './learn-walkthrough-page.css',
})
export class LearnWalkthroughPage {
  private readonly progress = inject(LearnProgressService);

  readonly meta = getLesson('first-evaluation-lab');
  readonly prereqMeta = getLesson(this.meta?.prerequisites[0] ?? '');
  readonly nextLessonMeta = getLesson('automation-and-judges');
  readonly content = loadWalkthroughContent();
  readonly hasSteps = this.content.steps.length > 0;
  readonly trackLabCount = getLessonsForTrack('llm-systems').filter((lesson) => lesson.status === 'live').length;
  readonly trackLabel = computed(() => {
    const trackId = this.meta?.trackId;
    const trackTitle = trackId ? getTrack(trackId)?.title : null;
    return trackTitle ?? 'Lab';
  });
  readonly completed = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('first-evaluation-lab');
  });
  readonly canMarkComplete = computed(() =>
    this.meta ? this.progress.canMarkComplete(this.meta) : false,
  );

  markComplete(): void {
    if (!this.canMarkComplete()) {
      return;
    }
    this.progress.markComplete('first-evaluation-lab');
  }
}
