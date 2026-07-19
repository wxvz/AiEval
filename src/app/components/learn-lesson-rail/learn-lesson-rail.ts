import { Component, computed, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { LearnLessonMeta } from '../../learn/curriculum';
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
  readonly locked = input(false);
  readonly savedKeyTerms = input<LearnGlossaryTerm[]>([]);

  private readonly expandedKeyTerms = signal<ReadonlySet<LearnGlossaryTerm>>(new Set());
  /** Tracks prior saved terms so newly clicked ones open expanded without reopening user-collapsed ones. */
  private previousSavedTerms = new Set<LearnGlossaryTerm>();

  constructor() {
    effect(() => {
      const saved = this.savedKeyTerms();
      const savedSet = new Set(saved);
      const newlySaved = saved.filter((term) => !this.previousSavedTerms.has(term));

      this.expandedKeyTerms.update((expanded) => {
        const next = new Set([...expanded].filter((term) => savedSet.has(term)));
        for (const term of newlySaved) {
          next.add(term);
        }
        const unchanged =
          next.size === expanded.size && [...next].every((term) => expanded.has(term));
        return unchanged ? expanded : next;
      });

      this.previousSavedTerms = savedSet;
    });
  }

  readonly sections = computed(() =>
    (this.content()?.sections ?? []).map((section, index) => ({
      index,
      title: section.title ?? section.heading ?? `Section ${index + 1}`,
      solved: this.sectionsSolved()[index] === true,
    })),
  );

  readonly keyTermEntries = computed(() =>
    this.savedKeyTerms().map((term) => ({
      term,
      label: LEARN_GLOSSARY[term].label,
      explanation: LEARN_GLOSSARY[term].explanation,
    })),
  );

  isKeyTermExpanded(term: LearnGlossaryTerm): boolean {
    return this.expandedKeyTerms().has(term);
  }

  toggleKeyTerm(term: LearnGlossaryTerm): void {
    this.expandedKeyTerms.update((expanded) => {
      const next = new Set(expanded);
      if (next.has(term)) {
        next.delete(term);
      } else {
        next.add(term);
      }
      return next;
    });
  }
}
