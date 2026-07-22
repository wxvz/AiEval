import { Injectable, signal } from '@angular/core';

import { getKnownLessonIds, type LearnLessonMeta } from './curriculum';
import { lessonHasBody } from './learn-content';
import { walkthroughHasSteps } from './walkthrough-content';

const STORAGE_KEY = 'aieval-learn-progress';

@Injectable({ providedIn: 'root' })
export class LearnProgressService {
  private readonly revision = signal(0);

  completedIds(): Set<string> {
    this.revision();
    return this.readStored();
  }

  isComplete(id: string): boolean {
    return this.completedIds().has(id);
  }

  markComplete(id: string): void {
    const known = getKnownLessonIds();
    if (!known.has(id)) {
      return;
    }
    const next = new Set(this.readStored());
    next.add(id);
    this.writeStored(next);
    this.revision.update((value) => value + 1);
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.revision.update((value) => value + 1);
  }

  canMarkComplete(lesson: LearnLessonMeta): boolean {
    if (lesson.kind === 'interactive') {
      return true;
    }
    if (lesson.kind === 'tool') {
      return walkthroughHasSteps();
    }
    return lessonHasBody(lesson.id);
  }

  private readStored(): Set<string> {
    const known = getKnownLessonIds();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return new Set();
      }
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return new Set();
      }
      return new Set(parsed.filter((id): id is string => typeof id === 'string' && known.has(id)));
    } catch {
      return new Set();
    }
  }

  private writeStored(ids: Set<string>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  }
}
