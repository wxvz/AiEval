import { Injectable, signal } from '@angular/core';

export interface LearnLessonSessionState {
  sectionsSolved: boolean[];
  recapSolved: boolean[];
  collapsed: boolean[];
}

function storageKey(lessonId: string): string {
  return `aieval-learn-lesson-${lessonId}`;
}

@Injectable({ providedIn: 'root' })
export class LearnLessonSessionService {
  private readonly revision = signal(0);

  /** Bumped when session state changes; subscribe in computed() to refresh. */
  readonly changed = this.revision.asReadonly();

  read(lessonId: string): LearnLessonSessionState | null {
    this.revision();
    return this.readStored(lessonId);
  }

  init(
    lessonId: string,
    sectionCount: number,
    recapCount: number,
  ): LearnLessonSessionState {
    const existing = this.readStored(lessonId);
    if (existing) {
      return this.normalize(existing, sectionCount, recapCount);
    }
    const state: LearnLessonSessionState = {
      sectionsSolved: Array.from({ length: sectionCount }, () => false),
      recapSolved: Array.from({ length: recapCount }, () => false),
      collapsed: Array.from({ length: sectionCount }, () => false),
    };
    this.writeStored(lessonId, state);
    return state;
  }

  update(lessonId: string, state: LearnLessonSessionState): void {
    this.writeStored(lessonId, state);
    this.revision.update((value) => value + 1);
  }

  setSectionSolved(lessonId: string, index: number, solved: boolean, collapsed: boolean): void {
    const state = this.readStored(lessonId);
    if (!state) {
      return;
    }
    const next = {
      sectionsSolved: [...state.sectionsSolved],
      recapSolved: [...state.recapSolved],
      collapsed: [...state.collapsed],
    };
    next.sectionsSolved[index] = solved;
    next.collapsed[index] = collapsed;
    this.writeStored(lessonId, next);
    this.revision.update((value) => value + 1);
  }

  setRecapSolved(lessonId: string, index: number, solved: boolean): void {
    const state = this.readStored(lessonId);
    if (!state) {
      return;
    }
    const next = {
      sectionsSolved: [...state.sectionsSolved],
      recapSolved: [...state.recapSolved],
      collapsed: [...state.collapsed],
    };
    next.recapSolved[index] = solved;
    this.writeStored(lessonId, next);
    this.revision.update((value) => value + 1);
  }

  setCollapsed(lessonId: string, index: number, collapsed: boolean): void {
    const state = this.readStored(lessonId);
    if (!state) {
      return;
    }
    const next = {
      sectionsSolved: [...state.sectionsSolved],
      recapSolved: [...state.recapSolved],
      collapsed: [...state.collapsed],
    };
    next.collapsed[index] = collapsed;
    this.writeStored(lessonId, next);
    this.revision.update((value) => value + 1);
  }

  allSolved(state: LearnLessonSessionState): boolean {
    return (
      state.sectionsSolved.every(Boolean) &&
      state.recapSolved.length > 0 &&
      state.recapSolved.every(Boolean)
    );
  }

  clear(lessonId: string): void {
    sessionStorage.removeItem(storageKey(lessonId));
    this.revision.update((value) => value + 1);
  }

  private normalize(
    state: LearnLessonSessionState,
    sectionCount: number,
    recapCount: number,
  ): LearnLessonSessionState {
    return {
      sectionsSolved: padBooleans(state.sectionsSolved, sectionCount),
      recapSolved: padBooleans(state.recapSolved, recapCount),
      collapsed: padBooleans(state.collapsed, sectionCount),
    };
  }

  private readStored(lessonId: string): LearnLessonSessionState | null {
    try {
      const raw = sessionStorage.getItem(storageKey(lessonId));
      if (!raw) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      const record = parsed as Partial<LearnLessonSessionState>;
      if (!Array.isArray(record.sectionsSolved) || !Array.isArray(record.recapSolved)) {
        return null;
      }
      return {
        sectionsSolved: record.sectionsSolved.map(Boolean),
        recapSolved: record.recapSolved.map(Boolean),
        collapsed: Array.isArray(record.collapsed) ? record.collapsed.map(Boolean) : [],
      };
    } catch {
      return null;
    }
  }

  private writeStored(lessonId: string, state: LearnLessonSessionState): void {
    sessionStorage.setItem(storageKey(lessonId), JSON.stringify(state));
  }
}

function padBooleans(values: boolean[], length: number): boolean[] {
  return Array.from({ length }, (_, index) => values[index] === true);
}
