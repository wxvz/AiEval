import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'aieval-learn-handoff';

export interface LearnHandoffEntry {
  evaluationId: string;
}

/** Per-lesson map so two labs do not clobber each other's back-links. */
export interface LearnHandoffState {
  byLesson: Record<string, LearnHandoffEntry>;
  /** Lesson that drives the dashboard banner and primary highlight. */
  activeLessonId: string | null;
  bannerDismissed: boolean;
}

export const LEARN_FROM_QUERY = 'learn';
export const LEARN_LESSON_QUERY = 'learnLesson';

@Injectable({ providedIn: 'root' })
export class LearnHandoffService {
  private readonly revision = signal(0);

  highlightedEvaluationId(): string | null {
    this.revision();
    const state = this.readStored();
    if (!state?.activeLessonId) {
      return null;
    }
    return state.byLesson[state.activeLessonId]?.evaluationId ?? null;
  }

  showDashboardBanner(): boolean {
    this.revision();
    const state = this.readStored();
    return !!state?.activeLessonId && !!state.byLesson[state.activeLessonId] && !state.bannerDismissed;
  }

  lessonId(): string | null {
    this.revision();
    return this.readStored()?.activeLessonId ?? null;
  }

  /** Lesson that recorded this evaluation (any lab), for Compare/Edit back links. */
  lessonIdForEvaluation(evaluationId: string): string | null {
    this.revision();
    const state = this.readStored();
    if (!state) {
      return null;
    }
    for (const [lessonId, entry] of Object.entries(state.byLesson)) {
      if (entry.evaluationId === evaluationId) {
        return lessonId;
      }
    }
    return null;
  }

  hasHandoffForLesson(lessonId: string): boolean {
    this.revision();
    return !!this.readStored()?.byLesson[lessonId]?.evaluationId;
  }

  evaluationIdForLesson(lessonId: string): string | null {
    this.revision();
    return this.readStored()?.byLesson[lessonId]?.evaluationId ?? null;
  }

  /**
   * Record or replace the evaluation for one tool lesson and make it active.
   * Re-runs for the same lesson replace that lesson's entry only.
   */
  recordEvaluation(evaluationId: string, lessonId: string): void {
    if (!evaluationId.trim() || !lessonId.trim()) {
      return;
    }
    const existing = this.readStored() ?? emptyState();
    const previousForLesson = existing.byLesson[lessonId]?.evaluationId;
    const next: LearnHandoffState = {
      byLesson: {
        ...existing.byLesson,
        [lessonId]: { evaluationId },
      },
      activeLessonId: lessonId,
      bannerDismissed:
        previousForLesson === evaluationId && existing.activeLessonId === lessonId
          ? existing.bannerDismissed
          : false,
    };
    this.writeStored(next);
    this.revision.update((value) => value + 1);
  }

  /** Prefer query `learnLesson` when opening the dashboard from a walkthrough step. */
  activateLesson(lessonId: string): void {
    const existing = this.readStored();
    if (!existing?.byLesson[lessonId]) {
      return;
    }
    if (existing.activeLessonId === lessonId) {
      return;
    }
    this.writeStored({
      ...existing,
      activeLessonId: lessonId,
      bannerDismissed: false,
    });
    this.revision.update((value) => value + 1);
  }

  dismissBanner(): void {
    const state = this.readStored();
    if (!state) {
      return;
    }
    this.writeStored({ ...state, bannerDismissed: true });
    this.revision.update((value) => value + 1);
  }

  clearLesson(lessonId: string): void {
    const existing = this.readStored();
    if (!existing?.byLesson[lessonId]) {
      return;
    }
    const byLesson = { ...existing.byLesson };
    delete byLesson[lessonId];
    const remaining = Object.keys(byLesson);
    if (remaining.length === 0) {
      this.clear();
      return;
    }
    const activeLessonId =
      existing.activeLessonId === lessonId ? (remaining[0] ?? null) : existing.activeLessonId;
    this.writeStored({
      byLesson,
      activeLessonId,
      bannerDismissed: existing.activeLessonId === lessonId ? true : existing.bannerDismissed,
    });
    this.revision.update((value) => value + 1);
  }

  clear(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this.revision.update((value) => value + 1);
  }

  isLearnContext(fromParam: string | null | undefined): boolean {
    return fromParam === LEARN_FROM_QUERY;
  }

  private readStored(): LearnHandoffState | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      const record = parsed as Partial<LearnHandoffState> & {
        evaluationId?: string;
        lessonId?: string;
      };

      // Legacy single-entry shape from earlier Learn labs.
      if (
        typeof record.evaluationId === 'string' &&
        typeof record.lessonId === 'string' &&
        !record.byLesson
      ) {
        return {
          byLesson: { [record.lessonId]: { evaluationId: record.evaluationId } },
          activeLessonId: record.lessonId,
          bannerDismissed: record.bannerDismissed === true,
        };
      }

      if (!record.byLesson || typeof record.byLesson !== 'object') {
        return null;
      }
      const byLesson: Record<string, LearnHandoffEntry> = {};
      for (const [lessonId, entry] of Object.entries(record.byLesson)) {
        if (entry && typeof entry === 'object' && typeof entry.evaluationId === 'string') {
          byLesson[lessonId] = { evaluationId: entry.evaluationId };
        }
      }
      if (Object.keys(byLesson).length === 0) {
        return null;
      }
      const activeLessonId =
        typeof record.activeLessonId === 'string' && byLesson[record.activeLessonId]
          ? record.activeLessonId
          : (Object.keys(byLesson)[0] ?? null);
      return {
        byLesson,
        activeLessonId,
        bannerDismissed: record.bannerDismissed === true,
      };
    } catch {
      return null;
    }
  }

  private writeStored(state: LearnHandoffState): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function emptyState(): LearnHandoffState {
  return { byLesson: {}, activeLessonId: null, bannerDismissed: false };
}
