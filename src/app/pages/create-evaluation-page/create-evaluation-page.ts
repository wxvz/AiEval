import { Component, computed, effect, HostListener, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import {
  EvaluationForm,
  EvaluationFormValue,
} from '../../components/evaluation-form/evaluation-form';
import { LeaveDuringAutomationComponent } from '../../components/leave-during-automation/leave-during-automation';
import { TokenUsageBadge } from '../../components/token-usage-badge/token-usage-badge';
import { AUTOMATION_METADATA_STUB, Evaluation } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-create-evaluation-page',
  imports: [
    RouterLink,
    EvaluationForm,
    AutomationControlsComponent,
    LeaveDuringAutomationComponent,
    TokenUsageBadge,
  ],
  templateUrl: './create-evaluation-page.html',
  styleUrl: './create-evaluation-page.css',
})
export class CreateEvaluationPage {
  private readonly evaluationService = inject(EvaluationService);
  private readonly router = inject(Router);

  private readonly evaluationForm = viewChild(EvaluationForm);
  private readonly leaveDuringAutomation = viewChild(LeaveDuringAutomationComponent);

  protected readonly createdEvaluationId = signal<string | null>(null);
  protected readonly generatingPrompt = signal(false);
  protected readonly creating = signal(false);
  private readonly formFieldsVersion = signal(0);

  constructor() {
    effect((onCleanup) => {
      const form = this.evaluationForm();

      if (!form) {
        return;
      }

      const subscription = form.form.valueChanges.subscribe(() => {
        this.formFieldsVersion.update((version) => version + 1);
      });

      this.formFieldsVersion.update((version) => version + 1);

      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected readonly automating = computed(() => {
    const id = this.createdEvaluationId();

    return id ? this.evaluationService.isAutomating(id) : false;
  });

  protected readonly displayTokenUsage = computed(() => {
    const id = this.createdEvaluationId();

    if (!id) {
      return null;
    }

    const current = this.evaluationService.getById(id);

    if (this.automating()) {
      return this.evaluationService.automationTokenUsage() ?? current?.tokenUsage;
    }

    return current?.tokenUsage;
  });

  protected readonly hasPartialFormForAutomation = computed(() => {
    this.formFieldsVersion();

    const form = this.evaluationForm();

    if (!form) {
      return false;
    }

    const { title, prompt } = form.getValue();
    const hasTitle = title.trim().length > 0;
    const hasPrompt = prompt.trim().length > 0;

    return hasTitle !== hasPrompt;
  });

  protected readonly canRunFullAutomation = computed(
    () =>
      !this.creating() &&
      !this.automating() &&
      !this.createdEvaluationId() &&
      !this.hasPartialFormForAutomation(),
  );

  protected readonly automationComplete = computed(() => {
    const id = this.createdEvaluationId();

    if (!id) {
      return false;
    }

    const evaluation = this.evaluationService.getById(id);

    return !!evaluation?.automatedAt && !this.automating();
  });

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.automating()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.automating()) {
      return true;
    }

    return this.leaveDuringAutomation()?.prompt() ?? true;
  }

  protected onSubmit(value: EvaluationFormValue): void {
    void this.createEvaluation(value)
      .then((created) => {
        void this.router.navigate(['/evaluations', created.id, 'edit']);
      })
      .catch(() => undefined);
  }

  protected onGeneratePrompt(): Promise<void> {
    const form = this.evaluationForm();

    if (!form) {
      return Promise.resolve();
    }

    if (this.generatingPrompt() || this.creating() || this.automating()) {
      return Promise.resolve();
    }

    this.generatingPrompt.set(true);

    const titlePromise = form.isTitleValid()
      ? Promise.resolve(form.getValue().title.trim())
      : this.evaluationService.generateTitle();

    return titlePromise
      .then((title) => {
        form.setTitle(title);
        return this.evaluationService.generatePrompt(title, {
          success: 'Prompt generated.',
          error: 'Could not generate prompt.',
        });
      })
      .then((prompt) => {
        form.setPrompt(prompt);
      })
      .catch(() => undefined)
      .finally(() => {
        this.generatingPrompt.set(false);
      });
  }

  protected onRunFullAutomation(): Promise<void> {
    if (!this.canRunFullAutomation() || this.isPartialFormForAutomation()) {
      return Promise.resolve();
    }

    this.creating.set(true);

    return this.createEvaluation(this.resolveFullAutomationCreateValue())
      .then((created) => {
        this.createdEvaluationId.set(created.id);
      })
      .catch(() => undefined)
      .finally(() => {
        this.creating.set(false);
      });
  }

  private isPartialFormForAutomation(): boolean {
    const form = this.evaluationForm();

    if (!form) {
      return false;
    }

    const { title, prompt } = form.getValue();
    const hasTitle = title.trim().length > 0;
    const hasPrompt = prompt.trim().length > 0;

    return hasTitle !== hasPrompt;
  }

  private resolveFullAutomationCreateValue(): EvaluationFormValue {
    const form = this.evaluationForm();

    if (!form) {
      return {
        title: AUTOMATION_METADATA_STUB,
        prompt: AUTOMATION_METADATA_STUB,
      };
    }

    const { title, prompt } = form.getValue();
    const trimmedTitle = title.trim();
    const trimmedPrompt = prompt.trim();

    if (trimmedTitle.length > 0 && trimmedPrompt.length > 0) {
      return { title: trimmedTitle, prompt: trimmedPrompt };
    }

    return {
      title: AUTOMATION_METADATA_STUB,
      prompt: AUTOMATION_METADATA_STUB,
    };
  }

  private createEvaluation(value: EvaluationFormValue): Promise<Evaluation> {
    return this.evaluationService.create(value, {
      success: 'Evaluation created.',
      error: 'Could not create evaluation.',
    });
  }
}
