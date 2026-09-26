import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

import { LearnLessonAside } from '../../components/learn-lesson-aside/learn-lesson-aside';
import { LearnLessonRail } from '../../components/learn-lesson-rail/learn-lesson-rail';
import { LearnLessonSection } from '../../components/learn-lesson-section/learn-lesson-section';
import { LearnCheckQuestion } from '../../components/learn-check-question/learn-check-question';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson, getDirectBranchLessons, getNavigableAdjacent, getOptionalLabForLesson, getTrack, isLessonLocked } from '../../learn/curriculum';
import type { LearnGlossaryTerm } from '../../learn/learn-glossary';
import { loadLessonContent } from '../../learn/learn-content';
import { getPrimaryTermHintIds } from '../../learn/primary-term-hints';
import {
  LearnLessonSessionService,
  type LearnLessonSessionState,
} from '../../learn/learn-lesson-session.service';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-learn-lesson-page',
  imports: [LearnLessonSection, LearnCheckQuestion, LearnLessonAside, LearnLessonRail, PageShell],
  templateUrl: './learn-lesson-page.html',
  styleUrl: './learn-lesson-page.css',
})
export class LearnLessonPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly progress = inject(LearnProgressService);
  private readonly session = inject(LearnLessonSessionService);
  private readonly settings = inject(SettingsService);

  private readonly lessonIdParam = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('lessonId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('lessonId') ?? '' },
  );

  readonly lessonId = computed(() => this.lessonIdParam());
  readonly meta = computed(() => {
    const id = this.lessonId();
    return id ? getLesson(id) : null;
  });
  readonly content = computed(() => {
    const id = this.lessonId();
    return id ? loadLessonContent(id) : null;
  });
  readonly primaryHintIds = computed(() => {
    const content = this.content();
    return content ? getPrimaryTermHintIds(content) : new Map();
  });
  readonly track = computed(() => {
    const trackId = this.meta()?.trackId;
    return trackId ? getTrack(trackId) : null;
  });
  readonly adjacent = computed(() => getNavigableAdjacent(this.lessonId()));
  readonly completed = computed(() => {
    this.progress.completedIds();
    const id = this.meta()?.id;
    return id ? this.progress.isComplete(id) : false;
  });
  readonly locked = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    const lesson = this.meta();
    if (!lesson) {
      return false;
    }
    return isLessonLocked(lesson, this.progress.completedIds(), {
      ignorePrerequisites: this.settings.learnUnlockAll(),
    });
  });
  readonly canMarkComplete = computed(() => {
    const lesson = this.meta();
    return lesson ? this.progress.canMarkComplete(lesson) : false;
  });
  readonly hasContent = computed(() => (this.content()?.sections.length ?? 0) > 0);
  readonly savedKeyTerms = signal<LearnGlossaryTerm[]>([]);
  readonly sessionState = signal<LearnLessonSessionState | null>(null);

  readonly allChecksSolved = computed(() => {
    this.session.changed();
    const state = this.sessionState();
    const content = this.content();
    if (!state || !content) {
      return false;
    }
    if (content.sections.length === 0) {
      return false;
    }
    if (!state.sectionsSolved.every(Boolean)) {
      return false;
    }
    if (content.recapQuestions.length === 0) {
      return true;
    }
    return state.recapSolved.every(Boolean);
  });

  readonly markCompleteEnabled = computed(
    () => this.canMarkComplete() && this.allChecksSolved() && !this.completed(),
  );

  readonly optionalLab = computed(() => getOptionalLabForLesson(this.lessonId()));

  readonly optionalLabComplete = computed(() => {
    this.progress.completedIds();
    const lab = this.optionalLab();
    return lab ? this.progress.isComplete(lab.id) : false;
  });

  /** Branch labs/lessons under this spine (or branch) parent — shown in the aside. */
  readonly branchLessons = computed(() => getDirectBranchLessons(this.lessonId()));

  readonly branchLessonCompleteIds = computed(() => {
    this.progress.completedIds();
    const completed = this.progress.completedIds();
    return new Set(
      this.branchLessons()
        .filter((lesson) => completed.has(lesson.id))
        .map((lesson) => lesson.id),
    );
  });

  readonly recapCount = computed(() => this.content()?.recapQuestions.length ?? 0);

  readonly activeSectionIndex = computed(() => {
    this.session.changed();
    const state = this.sessionState();
    const content = this.content();
    if (!state || !content || content.sections.length === 0) {
      return 0;
    }
    const firstUnsolved = state.sectionsSolved.findIndex((solved) => !solved);
    if (firstUnsolved === -1) {
      return content.sections.length - 1;
    }
    return firstUnsolved;
  });

  readonly activeAside = computed(() => {
    this.session.changed();
    const content = this.content();
    if (!content) {
      return null;
    }
    return content.sections[this.activeSectionIndex()]?.aside ?? null;
  });

  selectKeyTerm(term: LearnGlossaryTerm): void {
    this.savedKeyTerms.update((terms) => [term, ...terms.filter((existing) => existing !== term)]);
  }

  constructor() {
    effect(() => {
      const id = this.lessonId();
      this.savedKeyTerms.set([]);

      const lesson = id ? getLesson(id) : null;
      if (!lesson || lesson.kind !== 'read' || lesson.status !== 'live') {
        if (id) {
          void this.router.navigate(['/learn']);
        }
        this.sessionState.set(null);
        return;
      }

      const content = loadLessonContent(id);
      if (!content) {
        this.sessionState.set(null);
        return;
      }

      const state = this.session.init(
        lesson.id,
        content.sections.length,
        content.recapQuestions.length,
      );
      this.sessionState.set(state);
    });
  }

  sectionSolved(index: number): boolean {
    return this.sessionState()?.sectionsSolved[index] === true;
  }

  sectionCollapsed(index: number): boolean {
    return this.sessionState()?.collapsed[index] === true;
  }

  recapSolved(index: number): boolean {
    return this.sessionState()?.recapSolved[index] === true;
  }

  onSectionSolved(index: number, solved: boolean): void {
    const lessonId = this.lessonId();
    if (!lessonId) {
      return;
    }
    this.session.setSectionSolved(lessonId, index, solved, false);
    this.refreshSession();
  }

  onSectionCollapsed(index: number, collapsed: boolean): void {
    const lessonId = this.lessonId();
    if (!lessonId) {
      return;
    }
    const state = this.sessionState();
    if (!state) {
      return;
    }
    this.session.setSectionSolved(lessonId, index, state.sectionsSolved[index] === true, collapsed);
    this.refreshSession();
  }

  onRecapSolved(index: number, solved: boolean): void {
    const lessonId = this.lessonId();
    if (!lessonId) {
      return;
    }
    this.session.setRecapSolved(lessonId, index, solved);
    this.refreshSession();
  }

  markComplete(): void {
    const lesson = this.meta();
    if (!lesson || !this.markCompleteEnabled()) {
      return;
    }
    this.progress.markComplete(lesson.id);
    this.session.clear(lesson.id);
  }

  private refreshSession(): void {
    const lessonId = this.lessonId();
    if (!lessonId) {
      return;
    }
    this.sessionState.set(this.session.read(lessonId));
  }
}
