import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { isCheckAnswerCorrect } from '../../learn/check-answer';
import type { CheckQuestion } from '../../learn/learn-content';
import type { LearnGlossaryTerm } from '../../learn/learn-glossary';
import { LearnLessonText } from '../learn-lesson-text/learn-lesson-text';

@Component({
  selector: 'app-learn-check-question',
  imports: [FormsModule, LearnLessonText],
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

  readonly userInput = signal('');
  readonly selectedChoice = signal('');
  readonly checked = signal(false);
  readonly isCorrect = signal<boolean | null>(null);

  readonly hasChoices = computed(() => (this.question().choices?.length ?? 0) > 0);
  readonly interactive = computed(() => !this.readonly() && !this.solved());

  constructor() {
    effect(() => {
      if (this.solved() && this.hasChoices()) {
        this.selectedChoice.set(this.question().answer);
        this.checked.set(true);
        this.isCorrect.set(true);
      }
    });
  }

  check(): void {
    if (!this.interactive()) {
      return;
    }
    const response = this.hasChoices() ? this.selectedChoice() : this.userInput();
    const correct = isCheckAnswerCorrect(response, this.question());
    this.checked.set(true);
    this.isCorrect.set(correct);
    if (correct) {
      this.solvedChange.emit(true);
    }
  }

  onInputChange(value: string): void {
    if (!this.interactive()) {
      return;
    }
    this.userInput.set(value);
    this.resetCheck();
  }

  onChoiceChange(choice: string): void {
    if (!this.interactive()) {
      return;
    }
    this.selectedChoice.set(choice);
    this.resetCheck();
  }

  private resetCheck(): void {
    if (this.checked()) {
      this.checked.set(false);
      this.isCorrect.set(null);
    }
  }
}
