import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'aieval-learn-handoff';

export interface LearnHandoffState {
  evaluationId: string;
  lessonId: string;
  bannerDismissed: boolean;
}

export const LEARN_FROM_QUERY = 'learn';

@Injectable({ providedIn: 'root' })
export class LearnHandoffService {
  private readonly revision = signal(0);

  highlightedEvaluationId(): string | null {
    this.revision();
    return this.readStored()?.evaluationId ?? null;
  }

  showDashboardBanner(): boolean {
    this.revision();
    const state = this.readStored();
    return !!state && !state.bannerDismissed;
  }

  lessonId(): string | null {
    this.revision();
    return this.readStored()?.lessonId ?? null;
  }

  recordEvaluation(evaluationId: string, lessonId = 'first-evaluation-lab'): void {
    const existing = this.readStored();
    const next: LearnHandoffState = {
      evaluationId,
      lessonId,
      bannerDismissed: existing?.evaluationId === evaluationId ? existing.bannerDismissed : false,
    };
    this.writeStored(next);
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
      const record = parsed as Partial<LearnHandoffState>;
      if (typeof record.evaluationId !== 'string' || typeof record.lessonId !== 'string') {
        return null;
      }
      return {
        evaluationId: record.evaluationId,
        lessonId: record.lessonId,
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
