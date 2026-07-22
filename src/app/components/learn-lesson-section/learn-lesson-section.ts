import { Component, computed, input, output } from '@angular/core';

import type { LessonSection } from '../../learn/learn-content';
import type { LearnGlossaryTerm } from '../../learn/learn-glossary';
import { LearnCheckQuestion } from '../learn-check-question/learn-check-question';
import { LearnLessonText } from '../learn-lesson-text/learn-lesson-text';

type SectionView = 'active' | 'solvedExpanded' | 'collapsed';

@Component({
  selector: 'app-learn-lesson-section',
  imports: [LearnLessonText, LearnCheckQuestion],
  templateUrl: './learn-lesson-section.html',
  styleUrl: './learn-lesson-section.css',
})
export class LearnLessonSection {
  readonly section = input.required<LessonSection>();
  readonly sectionIndex = input.required<number>();
  readonly solved = input(false);
  readonly collapsed = input(false);
  readonly savedTerms = input<LearnGlossaryTerm[]>([]);
  readonly primaryHintIds = input<ReadonlyMap<LearnGlossaryTerm, string>>(new Map());
  readonly termSelect = output<LearnGlossaryTerm>();
  readonly solvedChange = output<boolean>();
  readonly collapsedChange = output<boolean>();

  readonly heading = computed(() => this.section().title ?? this.section().heading ?? 'Section');
  readonly view = computed<SectionView>(() => {
    if (!this.solved()) {
      return 'active';
    }
    if (this.collapsed()) {
      return 'collapsed';
    }
    return 'solvedExpanded';
  });
  readonly showExplanation = computed(() => this.view() === 'solvedExpanded');

  toggleCollapsed(): void {
    if (!this.solved()) {
      return;
    }
    this.collapsedChange.emit(!this.collapsed());
  }

  onSolved(solved: boolean): void {
    if (!solved) {
      return;
    }
    this.solvedChange.emit(true);
  }

  onTermSelect(term: LearnGlossaryTerm): void {
    this.termSelect.emit(term);
  }

  hintPrefix(suffix: string): string {
    return `s${this.sectionIndex()}-${suffix}`;
  }
}
