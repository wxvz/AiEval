import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  getLesson,
  getBranchSpurForLesson,
  getHubLessonsForTrack,
  getNextLesson,
  getTrack,
  isLessonLocked,
  type LearnBranchSpurNode,
  type LearnLessonMeta,
  type LearnTrackId,
} from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { SettingsService } from '../../services/settings.service';

export interface LearnTrackSpurRow {
  lesson: LearnLessonMeta;
  depth: number;
  complete: boolean;
  route: string | null;
  prereqLabel: string | null;
}

export interface LearnTrackLessonRow {
  lesson: LearnLessonMeta;
  index: number;
  complete: boolean;
  route: string | null;
  prereqLabel: string | null;
  isNext: boolean;
  spur: LearnTrackSpurRow[];
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

  readonly expandedIds = signal<ReadonlySet<string>>(new Set());

  readonly lessonRows = computed((): LearnTrackLessonRow[] => {
    const completed = this.progress.completedIds();
    const unlock = this.settings.learnUnlockAll();
    const nextId = getNextLesson(completed)?.id ?? null;

    return getHubLessonsForTrack(this.trackId()).map((lesson, index) => {
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
        index: index + 1,
        complete: completed.has(lesson.id),
        route,
        prereqLabel,
        isNext: lesson.id === nextId,
        spur: this.flattenSpur(getBranchSpurForLesson(lesson.id), completed, unlock),
      };
    });
  });

  readonly trackStats = computed(() => {
    const completed = this.progress.completedIds();
    const lessons = getHubLessonsForTrack(this.trackId()).filter((lesson) => lesson.status === 'live');
    const done = lessons.filter((lesson) => completed.has(lesson.id)).length;
    return { done, total: lessons.length };
  });

  trackTitle(): string {
    return getTrack(this.trackId())?.title ?? this.trackId();
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpand(id: string, spurParentId?: string): void {
    this.expandedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
        if (!spurParentId) {
          for (const row of this.lessonRows()) {
            if (row.lesson.id === id) {
              for (const spur of row.spur) {
                next.delete(spur.lesson.id);
              }
            }
          }
        }
      } else {
        next.add(id);
        if (spurParentId) {
          next.add(spurParentId);
        }
      }
      return next;
    });
  }

  onRowKeydown(event: KeyboardEvent, id: string, spurParentId?: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleExpand(id, spurParentId);
    }
  }
  private flattenSpur(
    nodes: LearnBranchSpurNode[],
    completed: Set<string>,
    unlock: boolean,
    depth = 0,
  ): LearnTrackSpurRow[] {
    const rows: LearnTrackSpurRow[] = [];
    for (const node of nodes) {
      const locked = isLessonLocked(node.lesson, completed, { ignorePrerequisites: unlock });
      const route =
        node.lesson.status === 'live' && node.lesson.route && !locked ? node.lesson.route : null;

      let prereqLabel: string | null = null;
      if (!unlock && locked) {
        const missing = node.lesson.prerequisites.find((id) => !completed.has(id));
        prereqLabel = missing ? (getLesson(missing)?.title ?? null) : null;
      }

      rows.push({
        lesson: node.lesson,
        depth,
        complete: completed.has(node.lesson.id),
        route,
        prereqLabel,
      });
      rows.push(...this.flattenSpur(node.children, completed, unlock, depth + 1));
    }
    return rows;
  }
}
