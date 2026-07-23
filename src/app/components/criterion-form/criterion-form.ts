import { Component, inject, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { FeedbackService } from '../../services/feedback.service';

export interface CriterionFormValue {
  name: string;
  description: string;
  maxPoints: number;
  weight: number;
}

@Component({
  selector: 'app-criterion-form',
  imports: [ReactiveFormsModule],
  templateUrl: './criterion-form.html',
  styleUrl: './criterion-form.css',
})
export class CriterionForm {
  private readonly feedback = inject(FeedbackService);

  readonly submitLabel = input('Add criterion');

  readonly submitted = output<CriterionFormValue>();

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    maxPoints: new FormControl(5, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
    weight: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01), Validators.max(100)],
    }),
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.feedback.error('Please enter a valid criterion name and max points.');
      return;
    }

    this.submitted.emit(this.form.getRawValue());
    this.form.reset({ name: '', description: '', maxPoints: 5, weight: 1 });
  }
}
