import { Injectable, inject, signal } from '@angular/core';

import { getKnownLessonIds, getLesson, isLessonLocked, type LearnLessonMeta } from './curriculum';
import { LearnHandoffService } from './learn-handoff.service';
import { lessonHasBody } from './learn-content';
import { walkthroughHasSteps } from './walkthrough-content';
import { EvaluationService } from '../services/evaluation.service';
import { SettingsService } from '../services/settings.service';

const STORAGE_KEY = 'aieval-learn-progress';

@Injectable({ providedIn: 'root' })
export class LearnProgressService {
  private readonly revision = signal(0);
  private readonly handoff = inject(LearnHandoffService);
  private readonly settings = inject(SettingsService);
  private readonly evaluations = inject(EvaluationService);

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
    const lesson = getLesson(id);
    const completed = this.readStored();
    if (
      lesson &&
      isLessonLocked(lesson, completed, {
        ignorePrerequisites: this.settings.learnUnlockAll(),
      })
    ) {
      return;
    }
    // Enforce tool automation evidence (and other canMarkComplete rules) at persist time.
    if (lesson && !this.canMarkComplete(lesson)) {
      return;
    }
    const next = new Set(completed);
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
      // Solve/success gates live on the lab page (completionDisabled + markLabComplete).
      return true;
    }
    if (lesson.kind === 'tool') {
      // Require an automated run for this lab, not only a stored handoff / step JSON.
      this.handoff.highlightedEvaluationId();
      this.evaluations.evaluations();
      if (!walkthroughHasSteps(lesson.id) || !this.handoff.hasHandoffForLesson(lesson.id)) {
        return false;
      }
      const evaluationId = this.handoff.evaluationIdForLesson(lesson.id);
      if (!evaluationId) {
        return false;
      }
      return !!this.evaluations.getById(evaluationId)?.automatedAt;
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
