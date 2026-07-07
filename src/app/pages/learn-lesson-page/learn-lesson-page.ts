import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { LearnLessonSection } from '../../components/learn-lesson-section/learn-lesson-section';
import { LearnCheckQuestion } from '../../components/learn-check-question/learn-check-question';
import { getAdjacentLessons, getLesson, getOptionalLabForLesson, getTrack, isLessonLocked } from '../../learn/curriculum';
import { loadLessonContent } from '../../learn/learn-content';
import {
  LearnLessonSessionService,
  type LearnLessonSessionState,
} from '../../learn/learn-lesson-session.service';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-learn-lesson-page',
  imports: [RouterLink, LearnLessonSection, LearnCheckQuestion],
  templateUrl: './learn-lesson-page.html',
  styleUrl: './learn-lesson-page.css',
})
export class LearnLessonPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly progress = inject(LearnProgressService);
  private readonly session = inject(LearnLessonSessionService);
  private readonly settings = inject(SettingsService);

  readonly lessonId = computed(() => this.route.snapshot.paramMap.get('lessonId') ?? '');
  readonly meta = computed(() => {
    const id = this.lessonId();
    return id ? getLesson(id) : null;
  });
  readonly content = computed(() => {
    const id = this.lessonId();
    return id ? loadLessonContent(id) : null;
  });
  readonly track = computed(() => {
    const trackId = this.meta()?.trackId;
    return trackId ? getTrack(trackId) : null;
  });
  readonly adjacent = computed(() => getAdjacentLessons(this.lessonId()));
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
  readonly openTermId = signal<string | null>(null);
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

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  ngOnInit(): void {
    const lesson = this.meta();
    if (!lesson || lesson.kind !== 'read' || lesson.status !== 'live') {
      void this.router.navigate(['/learn']);
      return;
    }
    const content = this.content();
    if (!content) {
      return;
    }
    const state = this.session.init(
      lesson.id,
      content.sections.length,
      content.recapQuestions.length,
    );
    this.sessionState.set(state);
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
