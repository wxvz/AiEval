import { Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { Answer } from '../../models/answer.model';
import { EMPTY_IMPROVED_ANSWER, ImprovedAnswer } from '../../models/improved-answer.model';

@Component({
  selector: 'app-improved-answer-editor',
  imports: [ReactiveFormsModule],
  templateUrl: './improved-answer-editor.html',
  styleUrl: './improved-answer-editor.css',
})
export class ImprovedAnswerEditor {
  readonly value = input<ImprovedAnswer | undefined>();

  readonly answers = input<Answer[]>([]);

  readonly winnerAnswerId = input<string | undefined>();

  readonly saved = output<ImprovedAnswer>();

  readonly form = new FormGroup({
    winningAnswer: new FormControl({ value: '', disabled: true }, { nonNullable: true }),
    strengths: new FormControl('', { nonNullable: true }),
    weaknesses: new FormControl('', { nonNullable: true }),
    usefulFromOthers: new FormControl('', { nonNullable: true }),
    finalAnswer: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const current = this.value() ?? EMPTY_IMPROVED_ANSWER;
      let winningAnswer = current.winningAnswer ?? '';

      if (!winningAnswer.trim()) {
        const winnerId = this.winnerAnswerId();
        const winner = this.answers().find((answer) => answer.id === winnerId);
        if (winner) {
          winningAnswer = winner.label;
        }
      }

      this.form.setValue({
        winningAnswer,
        strengths: current.strengths ?? '',
        weaknesses: current.weaknesses ?? '',
        usefulFromOthers: current.usefulFromOthers ?? '',
        finalAnswer: current.finalAnswer ?? '',
      });
    });
  }

  onSave(): void {
    const raw = this.form.getRawValue();
    this.saved.emit({
      winningAnswer: raw.winningAnswer.trim(),
      strengths: raw.strengths.trim(),
      weaknesses: raw.weaknesses.trim(),
      usefulFromOthers: raw.usefulFromOthers.trim(),
      finalAnswer: raw.finalAnswer.trim(),
    });
  }
}
