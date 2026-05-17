import { Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

export interface CriterionFormValue {
  name: string;
  description: string;
  maxPoints: number;
}

@Component({
  selector: 'app-criterion-form',
  imports: [ReactiveFormsModule],
  templateUrl: './criterion-form.html',
  styleUrl: './criterion-form.css',
})
export class CriterionForm {
  readonly submitLabel = input('Add criterion');

  readonly submitted = output<CriterionFormValue>();

  readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true }),
    maxPoints: new FormControl(5, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(100)],
    }),
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitted.emit(this.form.getRawValue());
    this.form.reset({ name: '', description: '', maxPoints: 5 });
  }
}
