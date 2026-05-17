import { Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
  readonly submitLabel = input('Add Answer');

  readonly submitted = output<AnswerFormValue>();

  readonly form = new FormGroup({
    label: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    content: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(5)] }),
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit(this.form.getRawValue());
    this.form.reset();
  }
}
