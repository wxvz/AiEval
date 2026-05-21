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
import { useAutomationPageContext } from '../../utils/automation-page-context';

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
  private readonly automationPage = useAutomationPageContext(() => this.createdEvaluationId());

  protected readonly completedEvaluationIds = signal<string[]>([]);
  private readonly automationSessionKey = signal(0);
  protected readonly generatingPrompt = signal(false);
  protected readonly creating = signal(false);
  private readonly formFieldsVersion = signal(0);

  protected readonly automating = this.automationPage.automating;
  protected readonly displayTokenUsage = this.automationPage.displayTokenUsage;

  protected readonly activeAutomationSession = computed(() => {
    const id = this.createdEvaluationId();
    const key = this.automationSessionKey();

    if (!id) {
      return [] as { key: string; evaluationId: string }[];
    }

    return [{ key: `${key}:${id}`, evaluationId: id }];
  });

  protected readonly showActiveAutomationControls = computed(() => {
    const id = this.createdEvaluationId();

    if (!id) {
      return false;
    }

    if (this.automating()) {
      return true;
    }

    if (!this.automationComplete()) {
      return true;
    }

    return !this.completedEvaluationIds().includes(id);
  });

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

  protected readonly automationBlocksActions = computed(() => {
    const id = this.createdEvaluationId();

    if (!id) {
      return this.evaluationService.isAutomating();
    }

    const evaluation = this.evaluationService.getById(id);

    if (evaluation?.automatedAt) {
      return false;
    }

    return this.evaluationService.isAutomating(id);
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
      !this.automationBlocksActions() &&
      !this.createdEvaluationId() &&
      !this.hasPartialFormForAutomation(),
  );

  protected readonly canRunNewFullAutomation = computed(
    () =>
      this.showFullAutomationRerun() && !this.creating() && !this.automationBlocksActions(),
  );

  protected readonly showFullAutomationRerun = computed(
    () => !!this.createdEvaluationId() && this.automationComplete(),
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

    if (this.generatingPrompt() || this.creating() || this.automationBlocksActions()) {
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

  protected getEvaluation(id: string): Evaluation | undefined {
    return this.evaluationService.getById(id);
  }

  protected onAutomationFinished(evaluation: Evaluation): void {
    this.applyAutomationResult(evaluation);
  }

  protected onAutomationStatusDismissed(): void {
    const id = this.createdEvaluationId();

    if (!id) {
      return;
    }

    const evaluation = this.evaluationService.getById(id);

    if (evaluation) {
      this.applyAutomationResult(evaluation);
    }
  }

  protected onRunFullAutomation(): Promise<void> {
    if (!this.canRunFullAutomation()) {
      return Promise.resolve();
    }

    return this.startFullAutomation({ useFormValues: true });
  }

  protected onRunNewFullAutomation(): Promise<void> {
    if (!this.canRunNewFullAutomation()) {
      return Promise.resolve();
    }

    const currentId = this.createdEvaluationId();

    if (currentId) {
      this.rememberCompletedEvaluation(currentId);
    }

    return this.startFullAutomation({ clearForm: true });
  }

  private applyAutomationResult(evaluation: Evaluation): void {
    this.rememberCompletedEvaluation(evaluation.id);
    this.syncFormFromEvaluation(evaluation);
  }

  private startFullAutomation(options: {
    clearForm?: boolean;
    useFormValues?: boolean;
  }): Promise<void> {
    const form = this.evaluationForm();

    if (options.clearForm && form) {
      form.setTitle('');
      form.setPrompt('');
    }

    const value = options.useFormValues
      ? this.resolveFullAutomationCreateValue()
      : this.stubCreateValue();

    this.creating.set(true);

    return this.createEvaluation(value)
      .then((created) => {
        this.automationSessionKey.update((key) => key + 1);
        this.createdEvaluationId.set(created.id);
      })
      .catch(() => undefined)
      .finally(() => {
        this.creating.set(false);
      });
  }

  private rememberCompletedEvaluation(id: string): void {
    const evaluation = this.evaluationService.getById(id);

    if (!evaluation?.automatedAt) {
      return;
    }

    this.completedEvaluationIds.update((ids) =>
      ids.includes(id) ? ids : [...ids, id],
    );
  }

  private stubCreateValue(): EvaluationFormValue {
    return {
      title: AUTOMATION_METADATA_STUB,
      prompt: AUTOMATION_METADATA_STUB,
    };
  }

  private resolveFullAutomationCreateValue(): EvaluationFormValue {
    const form = this.evaluationForm();

    if (!form) {
      return this.stubCreateValue();
    }

    const { title, prompt } = form.getValue();
    const trimmedTitle = title.trim();
    const trimmedPrompt = prompt.trim();

    if (trimmedTitle.length > 0 && trimmedPrompt.length > 0) {
      return { title: trimmedTitle, prompt: trimmedPrompt };
    }

    return this.stubCreateValue();
  }

  private createEvaluation(value: EvaluationFormValue): Promise<Evaluation> {
    return this.evaluationService.create(value, {
      success: 'Evaluation created.',
      error: 'Could not create evaluation.',
    });
  }

  private syncFormFromEvaluation(evaluation: Evaluation): void {
    const form = this.evaluationForm();

    if (!form) {
      return;
    }

    const title = evaluation.title.trim();
    const prompt = evaluation.prompt.trim();

    if (title && title !== AUTOMATION_METADATA_STUB) {
      form.setTitle(title);
    }

    if (prompt && prompt !== AUTOMATION_METADATA_STUB) {
      form.setPrompt(prompt);
    }
  }
}
