import { Component, computed, effect, input, output, signal } from '@angular/core';

import {
  gradeWordBankAssembly,
  isCheckAnswerCorrect,
  type WordPlacement,
} from '../../learn/check-answer';
import type { CheckQuestion } from '../../learn/learn-content';
import type { LearnGlossaryTerm } from '../../learn/learn-glossary';
import { LearnLessonText } from '../learn-lesson-text/learn-lesson-text';

@Component({
  selector: 'app-learn-check-question',
  imports: [LearnLessonText],
  templateUrl: './learn-check-question.html',
  styleUrl: './learn-check-question.css',
})
export class LearnCheckQuestion {
  private static idCounter = 0;

  readonly inputId = `learn-check-input-${LearnCheckQuestion.idCounter++}`;
  readonly question = input.required<CheckQuestion>();
  readonly hintIdPrefix = input('');
  readonly savedTerms = input<LearnGlossaryTerm[]>([]);
  readonly primaryHintIds = input<ReadonlyMap<LearnGlossaryTerm, string>>(new Map());
  readonly termSelect = output<LearnGlossaryTerm>();
  readonly solved = input(false);
  readonly readonly = input(false);
  readonly showExplanation = input(false);
  readonly solvedChange = output<boolean>();

  readonly selectedChoice = signal('');
  /** Indices into wordBank for the assembled answer, in tap order. */
  readonly assembledIndices = signal<number[]>([]);
  readonly checked = signal(false);
  readonly isCorrect = signal<boolean | null>(null);
  /** Per-assembled-word placement after Check (word-bank only). */
  readonly wordFeedback = signal<WordPlacement[] | null>(null);

  readonly hasChoices = computed(() => (this.question().choices?.length ?? 0) > 0);
  readonly hasWordBank = computed(
    () => !this.hasChoices() && (this.question().wordBank?.length ?? 0) > 0,
  );
  readonly interactive = computed(() => !this.readonly() && !this.solved());

  readonly assembledWords = computed(() => {
    const bank = this.question().wordBank ?? [];
    return this.assembledIndices().map((index) => bank[index] ?? '');
  });

  readonly assembledText = computed(() => this.assembledWords().join(' '));

  constructor() {
    effect(() => {
      const question = this.question();
      const solved = this.solved();

      if (solved) {
        if ((question.choices?.length ?? 0) > 0) {
          this.selectedChoice.set(question.answer);
        } else {
          this.selectedChoice.set('');
        }
        this.assembledIndices.set([]);
        this.wordFeedback.set(null);
        this.checked.set(true);
        this.isCorrect.set(true);
        return;
      }

      // Route reuse keeps this component; clear prior lesson answer UI unless solved.
      this.selectedChoice.set('');
      this.assembledIndices.set([]);
      this.checked.set(false);
      this.isCorrect.set(null);
      this.wordFeedback.set(null);
    });
  }

  isChipUsed(index: number): boolean {
    return this.assembledIndices().includes(index);
  }

  placementAt(position: number): WordPlacement | null {
    return this.wordFeedback()?.[position] ?? null;
  }

  addChip(index: number): void {
    if (!this.interactive() || this.isChipUsed(index)) {
      return;
    }
    this.assembledIndices.update((indices) => [...indices, index]);
    this.resetCheck();
  }

  removeAssembled(position: number): void {
    if (!this.interactive()) {
      return;
    }
    this.assembledIndices.update((indices) => indices.filter((_, i) => i !== position));
    this.resetCheck();
  }

  clearAssembled(): void {
    if (!this.interactive()) {
      return;
    }
    this.assembledIndices.set([]);
    this.resetCheck();
  }

  check(): void {
    if (!this.interactive()) {
      return;
    }
    const response = this.hasChoices() ? this.selectedChoice() : this.assembledText();
    const correct = isCheckAnswerCorrect(response, this.question());
    this.checked.set(true);
    this.isCorrect.set(correct);
    if (this.hasWordBank()) {
      const words = this.assembledWords();
      this.wordFeedback.set(
        correct
          ? words.map(() => 'correct' as const)
          : gradeWordBankAssembly(words, this.question().answer),
      );
    }
    if (correct) {
      this.solvedChange.emit(true);
    }
  }

  onChoiceChange(choice: string): void {
    if (!this.interactive()) {
      return;
    }
    this.selectedChoice.set(choice);
    this.resetCheck();
  }

  private resetCheck(): void {
    if (this.checked() || this.wordFeedback() !== null) {
      this.checked.set(false);
      this.isCorrect.set(null);
      this.wordFeedback.set(null);
    }
  }
}
