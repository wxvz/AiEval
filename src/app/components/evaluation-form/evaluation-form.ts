import { Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { Evaluation } from '../../models';

export interface EvaluationFormValue {
  title: string;
  prompt: string;
}

@Component({
  selector: 'app-evaluation-form',
  imports: [ReactiveFormsModule],
  templateUrl: './evaluation-form.html',
  styleUrl: './evaluation-form.css',
})
export class EvaluationForm {
  readonly evaluation = input<Evaluation | null>(null);
  readonly submitLabel = input('Save');

  readonly submitted = output<EvaluationFormValue>();

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    prompt: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] }),
  });

  constructor() {
    effect(() => {
      const current = this.evaluation();

      if (current) {
        this.form.patchValue({ title: current.title, prompt: current.prompt });
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit(this.form.getRawValue());
  }
}
