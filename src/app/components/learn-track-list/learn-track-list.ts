import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  getLesson,
  getHubLessonsForTrack,
  getTrack,
  isLessonLocked,
  type LearnLessonMeta,
  type LearnTrackId,
} from '../../learn/curriculum';
import { HUB_COPY } from '../../learn/hub-content';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { SettingsService } from '../../services/settings.service';

export interface LearnTrackLessonRow {
  lesson: LearnLessonMeta;
  complete: boolean;
  route: string | null;
  prereqLabel: string | null;
}

@Component({
  selector: 'app-learn-track-list',
  imports: [RouterLink],
  templateUrl: './learn-track-list.html',
  styleUrl: './learn-track-list.css',
})
export class LearnTrackList {
  readonly trackId = input.required<LearnTrackId>();
  private readonly progress = inject(LearnProgressService);
  private readonly settings = inject(SettingsService);

  readonly description = () => HUB_COPY.tracks[this.trackId()] ?? '';

  readonly lessonRows = computed((): LearnTrackLessonRow[] => {
    const completed = this.progress.completedIds();
    const unlock = this.settings.learnUnlockAll();

    return getHubLessonsForTrack(this.trackId()).map((lesson) => {
      const locked = isLessonLocked(lesson, completed, { ignorePrerequisites: unlock });
      const route =
        lesson.status === 'live' && lesson.route && !locked ? lesson.route : null;

      let prereqLabel: string | null = null;
      if (!unlock && locked) {
        const missing = lesson.prerequisites.find((id) => !completed.has(id));
        prereqLabel = missing ? (getLesson(missing)?.title ?? null) : null;
      }

      return {
        lesson,
        complete: completed.has(lesson.id),
        route,
        prereqLabel,
      };
    });
  });

  trackTitle(): string {
    return getTrack(this.trackId())?.title ?? this.trackId();
  }
}
