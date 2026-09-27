import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { getLesson, type LearnLessonMeta } from '../../learn/curriculum';
import type { LessonContent } from '../../learn/learn-content';
import { LEARN_GLOSSARY, type LearnGlossaryTerm } from '../../learn/learn-glossary';

@Component({
  selector: 'app-learn-lesson-rail',
  imports: [RouterLink],
  templateUrl: './learn-lesson-rail.html',
  styleUrl: './learn-lesson-rail.css',
})
export class LearnLessonRail {
  readonly lesson = input.required<LearnLessonMeta>();
  readonly trackLabel = input('');
  readonly content = input<LessonContent | null>(null);
  readonly sectionsSolved = input<boolean[]>([]);
  readonly activeSectionIndex = input(0);
  readonly locked = input(false);
  readonly savedKeyTerms = input<LearnGlossaryTerm[]>([]);

  /** Parent lesson for branch/optional lessons; null falls back to hub. */
  readonly parentLesson = computed(() => {
    const current = this.lesson();
    if (current.parentLessonId) {
      return getLesson(current.parentLessonId) ?? null;
    }
    return null;
  });

  readonly sections = computed(() =>
    (this.content()?.sections ?? []).map((section, index) => ({
      index,
      title: section.title ?? section.heading ?? `Section ${index + 1}`,
      solved: this.sectionsSolved()[index] === true,
      active: index === this.activeSectionIndex(),
    })),
  );

  readonly keyTermEntries = computed(() =>
    this.savedKeyTerms().map((term) => ({
      term,
      label: LEARN_GLOSSARY[term].label,
      explanation: LEARN_GLOSSARY[term].explanation,
    })),
  );
}
