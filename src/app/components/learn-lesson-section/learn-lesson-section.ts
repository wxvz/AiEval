import { Component, computed, input, output, signal } from '@angular/core';

import type { LessonSection } from '../../learn/learn-content';
import { LearnCheckQuestion } from '../learn-check-question/learn-check-question';
import { LearnLessonText } from '../learn-lesson-text/learn-lesson-text';

type SectionView = 'active' | 'pendingCollapse' | 'collapsed' | 'reopened';

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
  readonly openTermId = input<string | null>(null);
  readonly openTermIdChange = output<string | null>();
  readonly solvedChange = output<boolean>();
  readonly collapsedChange = output<boolean>();

  readonly manuallyExpanded = signal(false);

  readonly heading = computed(() => this.section().title ?? this.section().heading ?? 'Section');
  readonly view = computed<SectionView>(() => {
    if (!this.solved()) {
      return 'active';
    }
    if (this.collapsed() && this.manuallyExpanded()) {
      return 'reopened';
    }
    if (this.collapsed()) {
      return 'collapsed';
    }
    return 'pendingCollapse';
  });
  readonly showExplanation = computed(() => this.view() === 'reopened');

  toggleCollapsed(): void {
    if (!this.solved()) {
      return;
    }
    if (this.view() === 'collapsed') {
      this.manuallyExpanded.set(true);
      return;
    }
    if (this.view() === 'reopened') {
      this.manuallyExpanded.set(false);
      this.collapsedChange.emit(true);
    }
  }

  onSolved(solved: boolean): void {
    if (!solved) {
      return;
    }
    this.solvedChange.emit(true);
    this.manuallyExpanded.set(false);
    window.setTimeout(() => {
      this.collapsedChange.emit(true);
    }, 700);
  }

  setOpenTermId(id: string | null): void {
    this.openTermIdChange.emit(id);
  }

  hintPrefix(suffix: string): string {
    return `s${this.sectionIndex()}-${suffix}`;
  }
}
