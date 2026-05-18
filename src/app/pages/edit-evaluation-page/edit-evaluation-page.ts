import { Component, computed, HostListener, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AnswerCard } from '../../components/answer-card/answer-card';
import { AnswerForm, AnswerFormValue } from '../../components/answer-form/answer-form';
import { ConfirmDeleteModal } from '../../components/confirm-delete-modal/confirm-delete-modal';
import {
  ProviderChoiceDetails,
  ProviderChoiceModal,
} from '../../components/provider-choice-modal/provider-choice-modal';
import { CriterionCard } from '../../components/criterion-card/criterion-card';
import { CriterionForm, CriterionFormValue } from '../../components/criterion-form/criterion-form';
import { EmptyState } from '../../components/empty-state/empty-state';
import {
  EvaluationForm,
  EvaluationFormValue,
} from '../../components/evaluation-form/evaluation-form';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import {
  automationProgressLabel,
  automationStatusFromError,
  AutomationOutcome,
  AutomationProgressEvent,
  AutomationRunStatus,
  CriteriaMode,
  idleAutomationOutcome,
} from '../../models';
import { EvaluationService } from '../../services/evaluation.service';

declare const bootstrap: {
  Modal: {
    getOrCreateInstance: (element: Element) => { show: () => void; hide: () => void };
  };
};

@Component({
  selector: 'app-edit-evaluation-page',
  imports: [
    RouterLink,
    EvaluationForm,
    CriterionForm,
    CriterionCard,
    AnswerForm,
    AnswerCard,
    EmptyState,
    LoadingSpinner,
    ConfirmDeleteModal,
    ProviderChoiceModal,
  ],
  templateUrl: './edit-evaluation-page.html',
  styleUrl: './edit-evaluation-page.css',
})
export class EditEvaluationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  private readonly providerChoiceModal = viewChild(ProviderChoiceModal);
  private pendingProviderChoiceResolve: ((useCloud: boolean) => void) | null = null;
  private pendingLeaveResolve: ((allow: boolean) => void) | null = null;

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly automating = computed(() =>
    this.evaluationService.isAutomating(this.evaluationId),
  );
  protected readonly automationOutcome = signal<AutomationOutcome>(idleAutomationOutcome());
  protected readonly showAutomationStatus = computed(
    () => this.automating() || this.automationOutcome().status !== 'idle',
  );
  protected readonly progressSteps = signal<string[]>([]);
  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));
  protected readonly activeCriteria = computed(() => {
    const current = this.evaluation();

    return current ? this.evaluationService.getActiveCriteria(current) : [];
  });

  protected readonly criteriaMode = computed(
    () => this.evaluation()?.criteriaMode ?? 'default',
  );

  protected readonly canAutomate = computed(() => {
    const current = this.evaluation();

    return !!current?.prompt.trim() && !this.automating();
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

    return new Promise((resolve) => {
      this.pendingLeaveResolve = resolve;
      const modalElement = document.getElementById('confirmLeaveDuringAutomationModal');

      if (modalElement) {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
      } else {
        resolve(false);
      }
    });
  }

  protected onEvaluationSubmit(value: EvaluationFormValue): void {
    this.evaluationService.update(this.evaluationId, value, {
      success: 'Changes saved.',
      error: 'Could not save changes.',
    });
  }

  protected setCriteriaMode(criteriaMode: CriteriaMode): void {
    this.evaluationService.setCriteriaMode(this.evaluationId, criteriaMode, {
      success:
        criteriaMode === 'default' ? 'Using default criteria.' : 'Using custom criteria.',
      error: 'Could not update criteria mode.',
    });
  }

  protected onCriterionSubmit(value: CriterionFormValue): void {
    this.evaluationService.addCriterion(
      this.evaluationId,
      {
        name: value.name,
        maxPoints: value.maxPoints,
        ...(value.description.trim() ? { description: value.description } : {}),
      },
      {
        success: 'Criterion added.',
        error: 'Could not add criterion.',
      },
    );
  }

  protected removeCriterion(criterionId: string): void {
    const current = this.evaluation();

    if (!current) {
      return;
    }

    this.evaluationService.update(
      this.evaluationId,
      {
        criteria: current.criteria.filter((criterion) => criterion.id !== criterionId),
      },
      {
        success: 'Criterion removed.',
        error: 'Could not remove criterion.',
      },
    );
  }

  protected onAnswerSubmit(value: AnswerFormValue): void {
    this.evaluationService.addAnswer(this.evaluationId, value, {
      success: 'Model answer added.',
      error: 'Could not add model answer.',
    });
  }

  protected removeAnswer(answerId: string): void {
    const current = this.evaluation();

    if (!current) {
      return;
    }

    this.evaluationService.update(
      this.evaluationId,
      {
        answers: current.answers.filter((answer) => answer.id !== answerId),
      },
      {
        success: 'Model answer removed.',
        error: 'Could not remove model answer.',
      },
    );
  }

  protected onAutomateClick(): void {
    const current = this.evaluation();

    if (!current?.prompt.trim()) {
      return;
    }

    if (current.answers.length > 0) {
      const modalElement = document.getElementById('confirmRerunAutomationModal');

      if (modalElement) {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
      }

      return;
    }

    void this.runAutomate(false);
  }

  protected onRerunConfirmed(): void {
    void this.runAutomate(true);
  }

  protected onRerunCancelled(): void {
    // modal dismissed
  }

  protected onLeaveConfirmed(): void {
    this.evaluationService.cancelAutomation(this.evaluationId);
    this.progressSteps.update((steps) => [...steps, 'Automation stopped.']);
    this.pendingLeaveResolve?.(true);
    this.pendingLeaveResolve = null;
  }

  protected onLeaveCancelled(): void {
    this.pendingLeaveResolve?.(false);
    this.pendingLeaveResolve = null;
  }

  protected onProviderChoiceCloud(): void {
    this.resolveProviderChoice(true);
  }

  protected onProviderChoiceLocal(): void {
    this.resolveProviderChoice(false);
  }

  protected onStopAutomation(): void {
    this.cancelProviderChoicePrompt();
    this.evaluationService.cancelAutomation(this.evaluationId);
    this.automationOutcome.set({ status: 'cancelled' });
    this.progressSteps.update((steps) => [...steps, 'Automation stopped.']);
  }

  protected onDismissAutomationStatus(): void {
    this.automationOutcome.set(idleAutomationOutcome());
    this.progressSteps.set([]);
  }

  private setAutomationStatus(status: AutomationRunStatus): void {
    this.automationOutcome.set({ status });
  }

  private async runAutomate(force: boolean): Promise<void> {
    this.setAutomationStatus('running');
    this.progressSteps.set(['Starting automation…']);

    try {
      await this.evaluationService.automate(
        this.evaluationId,
        { force },
        {
          onStatus: (status) => this.setAutomationStatus(status),
          onProgress: (event) => {
            const label = automationProgressLabel(event);

            if (!label) {
              return;
            }

            this.progressSteps.update((steps) => [...steps, label]);
          },
          onSlowProviderPrompt: (event) => this.promptProviderChoice(event),
          operationFeedback: {
            success: 'Automated evaluation complete.',
            error: 'Automation failed.',
          },
        },
      );
    } catch (error) {
      this.cancelProviderChoicePrompt();
      const message = error instanceof Error ? error.message : 'Automation failed.';
      const status = automationStatusFromError(message);

      if (this.automationOutcome().status !== status) {
        this.setAutomationStatus(status);
      }

      this.progressSteps.update((steps) => {
        const last = steps[steps.length - 1];
        const label = `Error: ${message}`;

        return last === label ? steps : [...steps, label];
      });
    }
  }

  private promptProviderChoice(
    event: Extract<AutomationProgressEvent, { type: 'slow_provider_prompt' }>,
  ): Promise<boolean> {
    const details: ProviderChoiceDetails = {
      currentProvider: event.currentProvider,
      cloudProvider: event.cloudProvider,
      elapsedLabel: event.elapsedLabel,
    };

    return new Promise((resolve) => {
      this.pendingProviderChoiceResolve = resolve;
      const modal = this.providerChoiceModal();

      if (!modal) {
        this.resolveProviderChoicePending(false);
        return;
      }

      modal.setDetails(details);
      const modalElement = document.getElementById('providerChoiceModal');

      if (modalElement) {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
      } else {
        this.resolveProviderChoicePending(false);
      }
    });
  }

  private resolveProviderChoicePending(useCloud: boolean): void {
    const resolve = this.pendingProviderChoiceResolve;
    this.pendingProviderChoiceResolve = null;
    resolve?.(useCloud);
  }

  private resolveProviderChoice(useCloud: boolean): void {
    this.dismissProviderChoiceModal();
    this.resolveProviderChoicePending(useCloud);
  }

  private cancelProviderChoicePrompt(): void {
    this.dismissProviderChoiceModal();
    this.resolveProviderChoicePending(false);
  }

  private dismissProviderChoiceModal(): void {
    const modalElement = document.getElementById('providerChoiceModal');

    if (modalElement) {
      bootstrap.Modal.getOrCreateInstance(modalElement).hide();
    }
  }
}
