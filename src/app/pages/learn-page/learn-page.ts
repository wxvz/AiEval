import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnRoadmap } from '../../components/learn-roadmap/learn-roadmap';
import { LearnTrackList } from '../../components/learn-track-list/learn-track-list';
import { PageShell } from '../../components/page-shell/page-shell';
import {
  LEARN_TRACKS,
  getHubLessonsForTrack,
  getNextLesson,
  type LearnTrackId,
} from '../../learn/curriculum';
import { HUB_COPY } from '../../learn/hub-content';
import { LearnProgressService } from '../../learn/learn-progress.service';

export interface LearnTrackIndexRow {
  id: LearnTrackId;
  title: string;
  done: number;
  total: number;
  anchor: string;
}

@Component({
  selector: 'app-learn-page',
  imports: [RouterLink, LearnRoadmap, LearnTrackList, PageShell],
  templateUrl: './learn-page.html',
  styleUrl: './learn-page.css',
})
export class LearnPage {
  private readonly progress = inject(LearnProgressService);

  readonly hubCopy = HUB_COPY;
  readonly nextLesson = computed(() => getNextLesson(this.progress.completedIds()));
  readonly nextKindLabel = computed(() => {
    const next = this.nextLesson();
    if (!next) {
      return 'Curriculum';
    }
    if (next.kind === 'interactive') {
      return 'Lab';
    }
    if (next.kind === 'tool') {
      return 'Walkthrough';
    }
    return 'Lesson';
  });

  readonly trackIndex = computed((): LearnTrackIndexRow[] => {
    const completed = this.progress.completedIds();
    return LEARN_TRACKS.map((track) => {
      const lessons = getHubLessonsForTrack(track.id).filter((lesson) => lesson.status === 'live');
      const done = lessons.filter((lesson) => completed.has(lesson.id)).length;
      return {
        id: track.id,
        title: track.title,
        done,
        total: lessons.length,
        anchor: `track-${track.id}`,
      };
    });
  });

  readonly activeTrackId = computed((): LearnTrackId => {
    const next = this.nextLesson();
    return next?.trackId ?? 'foundation';
  });
}
