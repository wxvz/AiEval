import { Component, effect, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import { Evaluation } from '../../models';
import { FeedbackService } from '../../services/feedback.service';

export interface EvaluationFormValue {
  title: string;
  prompt: string;
}

function trimmedMinLength(min: number): ValidatorFn {
  return (control: AbstractControl<string>) => {
    const length = control.value.trim().length;

    if (length < min) {
      return {
        minlength: { requiredLength: min, actualLength: length },
      };
    }

    return null;
  };
}

@Component({
  selector: 'app-evaluation-form',
  imports: [ReactiveFormsModule],
  templateUrl: './evaluation-form.html',
  styleUrl: './evaluation-form.css',
})
export class EvaluationForm {
  private readonly feedback = inject(FeedbackService);

  readonly evaluation = input<Evaluation | null>(null);
  readonly submitLabel = input('Save');

  readonly submitted = output<EvaluationFormValue>();

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [trimmedMinLength(3)] }),
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

  getValue(): EvaluationFormValue {
    return this.form.getRawValue();
  }

  setTitle(title: string): void {
    this.form.controls.title.setValue(title);
    this.form.controls.title.markAsDirty();
    this.form.controls.title.markAsTouched();
  }

  setPrompt(prompt: string): void {
    this.form.controls.prompt.setValue(prompt);
    this.form.controls.prompt.markAsDirty();
    this.form.controls.prompt.markAsTouched();
  }

  isTitleValid(): boolean {
    return this.form.controls.title.valid;
  }

  isFormValid(): boolean {
    return this.form.valid;
  }

  markAllAsTouched(): void {
    this.form.markAllAsTouched();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.feedback.error('Please enter a valid title and prompt.');
      return;
    }

    this.submitted.emit(this.form.getRawValue());
  }
}
