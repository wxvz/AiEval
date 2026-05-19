import { Component, computed, effect, inject, input, signal, viewChild } from '@angular/core';

import {
  ConfirmDeleteModal,
} from '../confirm-delete-modal/confirm-delete-modal';
import { LoadingSpinner } from '../loading-spinner/loading-spinner';
import {
  ProviderChoiceDetails,
  ProviderChoiceModal,
} from '../provider-choice-modal/provider-choice-modal';
import {
  AutomationOutcome,
  AutomationPhase,
  AutomationProgressEvent,
  Evaluation,
  automationProgressLabel,
  automationStatusFromError,
  idleAutomationOutcome,
} from '../../models';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-automation-controls',
  imports: [LoadingSpinner, ConfirmDeleteModal, ProviderChoiceModal],
  templateUrl: './automation-controls.html',
})
export class AutomationControlsComponent {
  private readonly evaluationService = inject(EvaluationService);

  private readonly providerChoiceModal = viewChild(ProviderChoiceModal);
  private pendingProviderChoiceResolve: ((useCloud: boolean) => void) | null = null;

  readonly evaluationId = input.required<string>();
  readonly phase = input.required<AutomationPhase>();
  readonly buttonLabel = input.required<string>();
  readonly runningLabel = input.required<string>();
  readonly statusHint = input.required<string>();
  readonly successMessage = input.required<string>();
  readonly errorMessage = input.required<string>();
  readonly buttonClass = input('btn btn-primary btn-sm');
  readonly confirmForceTitle = input.required<string>();
  readonly confirmForceMessage = input.required<string>();
  readonly confirmForceLabel = input('Replace and run');
  readonly autoStart = input(false);
  readonly hideButton = input(false);

  private autoStartTriggered = false;

  protected readonly automationOutcome = signal<AutomationOutcome>(idleAutomationOutcome());
  protected readonly progressSteps = signal<string[]>([]);

  protected readonly automating = computed(() =>
    this.evaluationService.isAutomating(this.evaluationId()),
  );

  protected readonly showAutomationStatus = computed(
    () => this.automating() || this.automationOutcome().status !== 'idle',
  );

  protected readonly evaluation = computed(() =>
    this.evaluationService.getById(this.evaluationId()),
  );

  protected readonly canRun = computed(() => {
    const current = this.evaluation();

    return !!current && !this.automating();
  });

  protected readonly canRunPhase = computed(() =>
    canRunAutomationPhase(this.evaluation(), this.phase()),
  );

  protected readonly confirmForceModalId = computed(
    () => `confirmAutomation${this.phase()}${this.evaluationId()}`,
  );

  constructor() {
    effect(() => {
      if (!this.autoStart() || this.autoStartTriggered) {
        return;
      }

      const evaluation = this.evaluation();

      if (!evaluation || !this.canRunPhase() || this.automating()) {
        return;
      }

      this.autoStartTriggered = true;
      void this.runAutomate(false);
    });
  }

  protected readonly providerChoiceModalId = computed(
    () => `providerChoiceModal${this.phase()}${this.evaluationId()}`,
  );

  protected onAutomateClick(): void {
    if (!this.canRun()) {
      return;
    }

    if (this.needsForceConfirm()) {
      const modalElement = document.getElementById(this.confirmForceModalId());

      if (modalElement) {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
      }

      return;
    }

    void this.runAutomate(false);
  }

  protected onForceConfirmed(): void {
    void this.runAutomate(true);
  }

  protected onForceCancelled(): void {
    // modal dismissed
  }

  protected onProviderChoiceCloud(): void {
    this.resolveProviderChoice(true);
  }

  protected onProviderChoiceLocal(): void {
    this.resolveProviderChoice(false);
  }

  protected onStopAutomation(): void {
    this.cancelProviderChoicePrompt();
    this.evaluationService.cancelAutomation(this.evaluationId());
    this.automationOutcome.set({ status: 'cancelled' });
    this.progressSteps.update((steps) => [...steps, 'Automation stopped.']);
  }

  protected onDismissAutomationStatus(): void {
    this.automationOutcome.set(idleAutomationOutcome());
    this.progressSteps.set([]);
  }

  private needsForceConfirm(): boolean {
    const current = this.evaluation();

    if (!current) {
      return false;
    }

    switch (this.phase()) {
      case 'generate':
      case 'full':
        return current.answers.length > 0;
      case 'score':
        return !!(current.winnerAnswerId || current.automatedAt);
      case 'improved':
        return !!current.improvedAnswer;
    }
  }

  private async runAutomate(force: boolean): Promise<void> {
    this.automationOutcome.set({ status: 'running' });
    this.progressSteps.set(['Starting automation…']);

    try {
      await this.evaluationService.automate(
        this.evaluationId(),
        { force, phase: this.phase() },
        {
          onStatus: (status) => this.automationOutcome.set({ status }),
          onProgress: (event) => {
            const label = automationProgressLabel(event);

            if (!label) {
              return;
            }

            this.progressSteps.update((steps) => [...steps, label]);
          },
          onSlowProviderPrompt: (event) => this.promptProviderChoice(event),
          operationFeedback: {
            success: this.successMessage(),
            error: this.errorMessage(),
          },
        },
      );
    } catch (error) {
      this.cancelProviderChoicePrompt();
      const message = error instanceof Error ? error.message : this.errorMessage();
      const status = automationStatusFromError(message);

      if (this.automationOutcome().status !== status) {
        this.automationOutcome.set({ status });
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
      const modalElement = document.getElementById(this.providerChoiceModalId());

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
    const modalElement = document.getElementById(this.providerChoiceModalId());

    if (modalElement) {
      bootstrap.Modal.getOrCreateInstance(modalElement).hide();
    }
  }
}

export function canRunAutomationPhase(
  evaluation: Evaluation | undefined,
  phase: AutomationPhase,
): boolean {
  if (!evaluation) {
    return false;
  }

  switch (phase) {
    case 'generate':
    case 'full':
      return (
        !!evaluation.prompt.trim() &&
        (evaluation.criteriaMode === 'default' || evaluation.criteria.length > 0)
      );
    case 'score':
      return (
        !!evaluation.prompt.trim() &&
        evaluation.answers.length > 0 &&
        (evaluation.criteriaMode === 'default' || evaluation.criteria.length > 0)
      );
    case 'improved':
      return !!(
        evaluation.winnerAnswerId || evaluation.answers.some((answer) => answer.isWinner)
      );
  }
}
