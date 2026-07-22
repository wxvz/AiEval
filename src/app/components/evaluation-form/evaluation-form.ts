import { Component, effect, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import {
  DEFAULT_EVALUATION_CONFIG,
  Evaluation,
  EvaluationAudience,
  EvaluationConfig,
  EvaluationGoal,
  ResponseFormat,
  TaskDifficulty,
} from '../../models';
import { PageShell } from '../page-shell/page-shell';
import { FeedbackService } from '../../services/feedback.service';

export interface EvaluationFormValue {
  title: string;
  prompt: string;
  evaluationConfig: EvaluationConfig;
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
  imports: [ReactiveFormsModule, PageShell],
  templateUrl: './evaluation-form.html',
  styleUrl: './evaluation-form.css',
})
export class EvaluationForm {
  private readonly feedback = inject(FeedbackService);

  readonly evaluation = input<Evaluation | null>(null);
  readonly layout = input<'stacked' | 'aside'>('stacked');
  readonly submitLabel = input('Save');

  readonly submitted = output<EvaluationFormValue>();

  readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [trimmedMinLength(3)] }),
    prompt: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(10)] }),
    taskDifficulty: new FormControl<TaskDifficulty>('balanced', { nonNullable: true }),
    goal: new FormControl<EvaluationGoal>('general', { nonNullable: true }),
    audience: new FormControl<EvaluationAudience>('general', { nonNullable: true }),
    blindJudging: new FormControl(true, { nonNullable: true }),
    strictness: new FormControl<TaskDifficulty>('balanced', { nonNullable: true }),
    format: new FormControl<ResponseFormat>('freeform', { nonNullable: true }),
    maxWords: new FormControl<number | null>(null, { validators: [Validators.min(1)] }),
    requireCitations: new FormControl(false, { nonNullable: true }),
    requireCode: new FormControl(false, { nonNullable: true }),
    requireTests: new FormControl(false, { nonNullable: true }),
    expectedAnswer: new FormControl('', { nonNullable: true }),
    judgeModel: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const current = this.evaluation();

      if (current) {
        const config = current.evaluationConfig ?? DEFAULT_EVALUATION_CONFIG;
        this.form.patchValue({
          title: current.title,
          prompt: current.prompt,
          taskDifficulty: config.taskDifficulty,
          goal: config.goal,
          audience: config.audience,
          blindJudging: config.blindJudging,
          strictness: config.judgeProfile.strictness,
          format: config.responseConstraints.format,
          maxWords: config.responseConstraints.maxWords ?? null,
          requireCitations: config.responseConstraints.requireCitations,
          requireCode: config.responseConstraints.requireCode,
          requireTests: config.responseConstraints.requireTests,
          expectedAnswer: config.expectedAnswer ?? '',
          judgeModel: config.judgeProfile.model ?? '',
        });
      }
    });
  }

  getValue(): EvaluationFormValue {
    const value = this.form.getRawValue();
    const expectedAnswer = value.expectedAnswer.trim();
    const model = value.judgeModel.trim();

    return {
      title: value.title,
      prompt: value.prompt,
      evaluationConfig: {
        taskDifficulty: value.taskDifficulty,
        goal: value.goal,
        audience: value.audience,
        responseConstraints: {
          ...(value.maxWords && value.maxWords > 0 ? { maxWords: value.maxWords } : {}),
          format: value.format,
          requireCitations: value.requireCitations,
          requireCode: value.requireCode,
          requireTests: value.requireTests,
        },
        ...(expectedAnswer ? { expectedAnswer } : {}),
        blindJudging: value.blindJudging,
        judgeProfile: {
          strictness: value.strictness,
          ...(model ? { model } : {}),
        },
      },
    };
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

    this.submitted.emit(this.getValue());
  }
}
