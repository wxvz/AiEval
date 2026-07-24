import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { LessonAside, LessonContent } from '../../learn/learn-content';
import type { LearnLessonMeta } from '../../learn/curriculum';
import type { LearnGlossaryTerm } from '../../learn/learn-glossary';
import { LearnLessonText } from '../learn-lesson-text/learn-lesson-text';

@Component({
  selector: 'app-learn-lesson-aside',
  imports: [RouterLink, LearnLessonText],
  templateUrl: './learn-lesson-aside.html',
  styleUrl: './learn-lesson-aside.css',
})
export class LearnLessonAside {
  readonly content = input<LessonContent | null>(null);
  readonly sectionsSolved = input<boolean[]>([]);
  readonly recapSolved = input<boolean[]>([]);
  readonly recapCount = input(0);
  readonly optionalLab = input<LearnLessonMeta | null>(null);
  readonly optionalLabComplete = input(false);
  readonly adjacent = input<{ previous: LearnLessonMeta | null; next: LearnLessonMeta | null }>({
    previous: null,
    next: null,
  });
  readonly locked = input(false);
  readonly activeAside = input<LessonAside | null>(null);
  readonly savedKeyTerms = input<LearnGlossaryTerm[]>([]);
  readonly primaryHintIds = input<ReadonlyMap<LearnGlossaryTerm, string>>(new Map());
  readonly completed = input(false);
  readonly markCompleteEnabled = input(false);
  readonly termSelect = output<LearnGlossaryTerm>();
  readonly markComplete = output<void>();

  readonly sectionsDone = computed(() => this.sectionsSolved().filter(Boolean).length);
  readonly sectionsTotal = computed(() => this.content()?.sections.length ?? 0);
  readonly sectionsPercent = computed(() => {
    const total = this.sectionsTotal();
    if (total === 0) {
      return 0;
    }
    return Math.round((this.sectionsDone() / total) * 100);
  });

  readonly checksDone = computed(() => {
    const sections = this.sectionsSolved().filter(Boolean).length;
    const recap = this.recapSolved().filter(Boolean).length;
    return sections + recap;
  });

  readonly checksTotal = computed(() => {
    const content = this.content();
    if (!content) {
      return 0;
    }
    return content.sections.length + this.recapCount();
  });

  readonly asideActionLabel = computed(() => {
    const aside = this.activeAside();
    if (!aside?.route) {
      return null;
    }
    return aside.actionLabel?.trim() || 'Open in AiEval';
  });

  onTermSelect(term: LearnGlossaryTerm): void {
    this.termSelect.emit(term);
  }
}
