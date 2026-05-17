import { Component, inject, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { FeedbackService } from '../../services/feedback.service';

export interface AnswerFormValue {
  label: string;
  content: string;
}

@Component({
  selector: 'app-answer-form',
  imports: [ReactiveFormsModule],
  templateUrl: './answer-form.html',
  styleUrl: './answer-form.css',
})
export class AnswerForm {
  private readonly feedback = inject(FeedbackService);

  readonly submitLabel = input('Add model answer');

  readonly submitted = output<AnswerFormValue>();

  readonly form = new FormGroup({
    label: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    content: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] }),
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.feedback.error('Please enter a model name and answer.');
      return;
    }

    this.submitted.emit(this.form.getRawValue());
    this.form.reset();
  }
}
