import { Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';

import {
  ConfirmDeleteModal,
} from '../confirm-delete-modal/confirm-delete-modal';
import { LoadingSpinner } from '../loading-spinner/loading-spinner';
import { TokenUsageBadge } from '../token-usage-badge/token-usage-badge';
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
import { AppStatusService } from '../../services/app-status.service';
import { SettingsService } from '../../services/settings.service';

const AUTO_DISMISS_MS = 3000;

@Component({
  selector: 'app-automation-controls',
  imports: [LoadingSpinner, ConfirmDeleteModal, ProviderChoiceModal, TokenUsageBadge],
  templateUrl: './automation-controls.html',
})
export class AutomationControlsComponent {
  private readonly evaluationService = inject(EvaluationService);
  private readonly settingsService = inject(SettingsService);
  private readonly appStatus = inject(AppStatusService);

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

  readonly automationFinished = output<Evaluation>();
  readonly statusDismissed = output<void>();

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

  protected readonly displayTokenUsage = computed(() => {
    const current = this.evaluation();
    const evaluationId = this.evaluationId();

    if (this.automating()) {
      return this.evaluationService.getAutomationTokenUsage(evaluationId) ?? current?.tokenUsage;
    }

    return current?.tokenUsage;
  });

  protected readonly canRun = computed(() => {
    const current = this.evaluation();

    return !!current && !this.evaluationService.isAutomating(this.evaluationId());
  });

  protected readonly canRunPhase = computed(() =>
    canRunAutomationPhase(
      this.evaluation(),
      this.phase(),
      this.appStatus.answerModelCount(),
    ),
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

      if (!evaluation || !this.canRunPhase() || this.evaluationService.isAutomating(this.evaluationId())) {
        return;
      }

      this.autoStartTriggered = true;
      void this.runAutomate(false);
    });

    effect((onCleanup) => {
      if (!this.settingsService.autoDismissAutomationStatus()) {
        return;
      }

      const outcome = this.automationOutcome().status;

      if (outcome !== 'completed') {
        return;
      }

      const timeoutId = window.setTimeout(() => {
        this.onDismissAutomationStatus();
      }, AUTO_DISMISS_MS);

      onCleanup(() => window.clearTimeout(timeoutId));
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
    // Cancel server/client first so provider-choice POST is skipped (avoids 404 race).
    this.evaluationService.cancelAutomation(this.evaluationId());
    this.cancelProviderChoicePrompt();
    this.automationOutcome.set({ status: 'cancelled' });
    this.progressSteps.update((steps) => [...steps, 'Automation stopped.']);
  }

  protected onDismissAutomationStatus(): void {
    if (this.automating()) {
      this.evaluationService.cancelAutomation(this.evaluationId());
    }

    this.automationOutcome.set(idleAutomationOutcome());
    this.progressSteps.set([]);
    this.statusDismissed.emit();
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
    this.cancelProviderChoicePrompt();
    this.automationOutcome.set({ status: 'running' });
    this.progressSteps.set(['Starting automation…']);

    try {
      const evaluation = await this.evaluationService.automate(
        this.evaluationId(),
        { force, phase: this.phase() },
        {
          onStatus: (status) => {
            this.automationOutcome.set({ status });

            if (status === 'cancelled') {
              this.cancelProviderChoicePrompt();
            }
          },
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

      this.automationFinished.emit(evaluation);
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
    const preference = this.settingsService.automationProviderPreference();

    if (preference === 'local') {
      return Promise.resolve(false);
    }

    if (preference === 'cloud' && event.cloudProvider) {
      return Promise.resolve(true);
    }

    const details: ProviderChoiceDetails = {
      currentProvider: event.currentProvider,
      cloudProvider: event.cloudProvider,
      elapsedLabel: event.elapsedLabel,
      choiceTimeoutLabel: event.choiceTimeoutLabel,
    };

    return new Promise((resolve) => {
      this.pendingProviderChoiceResolve = resolve;
      const modal = this.providerChoiceModal();

      if (!modal) {
        // Do not silently keep-local — cancel so the server is not left waiting.
        this.cancelAutomationForMissingProviderChoiceUi();
        return;
      }

      modal.setDetails(details);
      const modalElement = document.getElementById(this.providerChoiceModalId());

      if (modalElement) {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
      } else {
        this.cancelAutomationForMissingProviderChoiceUi();
      }
    });
  }

  /** Missing modal host → cancel run (POST + clear UI); resolve pending so await unblocks. */
  private cancelAutomationForMissingProviderChoiceUi(): void {
    this.evaluationService.cancelAutomation(this.evaluationId());
    this.resolveProviderChoicePending(false);
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

/** Re-export for callers/tests that still import the fallback constant from this module. */
export { DEFAULT_ANSWER_SLOT_COUNT } from '../../services/app-status.service';

export function canRunAutomationPhase(
  evaluation: Evaluation | undefined,
  phase: AutomationPhase,
  expectedAnswerCount: number,
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
        expectedAnswerCount > 0 &&
        evaluation.answers.length === expectedAnswerCount &&
        (evaluation.criteriaMode === 'default' || evaluation.criteria.length > 0)
      );
    case 'improved':
      return !!(
        evaluation.winnerAnswerId || evaluation.answers.some((answer) => answer.isWinner)
      );
  }
}
