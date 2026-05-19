import { Component, computed, HostListener, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import { ConfirmDeleteModal } from '../../components/confirm-delete-modal/confirm-delete-modal';
import {
  EvaluationForm,
  EvaluationFormValue,
} from '../../components/evaluation-form/evaluation-form';
import { LeaveDuringAutomationPrompt } from '../../guards/leave-during-automation-prompt';
import { AUTOMATION_METADATA_STUB, Evaluation } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-create-evaluation-page',
  imports: [
    RouterLink,
    EvaluationForm,
    ConfirmDeleteModal,
    AutomationControlsComponent,
  ],
  templateUrl: './create-evaluation-page.html',
  styleUrl: './create-evaluation-page.css',
})
export class CreateEvaluationPage {
  private readonly evaluationService = inject(EvaluationService);
  private readonly router = inject(Router);

  private readonly evaluationForm = viewChild(EvaluationForm);
  private readonly leavePrompt = new LeaveDuringAutomationPrompt();

  protected readonly createdEvaluationId = signal<string | null>(null);
  protected readonly generatingPrompt = signal(false);
  protected readonly creating = signal(false);

  protected readonly automating = computed(() => {
    const id = this.createdEvaluationId();

    return id ? this.evaluationService.isAutomating(id) : false;
  });

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

    return this.leavePrompt.prompt();
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
    if (this.creating() || this.automating()) {
      return Promise.resolve();
    }

    this.creating.set(true);

    return this.createEvaluation({
      title: AUTOMATION_METADATA_STUB,
      prompt: AUTOMATION_METADATA_STUB,
    })
      .then((created) => {
        this.createdEvaluationId.set(created.id);
      })
      .catch(() => undefined)
      .finally(() => {
        this.creating.set(false);
      });
  }

  protected onLeaveConfirmed(): void {
    const id = this.createdEvaluationId();

    if (id) {
      this.evaluationService.cancelAutomation(id);
    }

    this.leavePrompt.confirmLeave();
  }

  protected onLeaveCancelled(): void {
    this.leavePrompt.cancelLeave();
  }

  private createEvaluation(value: EvaluationFormValue): Promise<Evaluation> {
    return this.evaluationService.create(value, {
      success: 'Evaluation created.',
      error: 'Could not create evaluation.',
    });
  }
}
