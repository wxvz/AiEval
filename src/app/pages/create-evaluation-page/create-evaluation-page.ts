import { Component, computed, HostListener, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import { ConfirmDeleteModal } from '../../components/confirm-delete-modal/confirm-delete-modal';
import {
  EvaluationForm,
  EvaluationFormValue,
} from '../../components/evaluation-form/evaluation-form';
import { Evaluation } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';

declare const bootstrap: {
  Modal: {
    getOrCreateInstance: (element: Element) => { show: () => void; hide: () => void };
  };
};

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
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  private readonly evaluationForm = viewChild(EvaluationForm);
  private pendingLeaveResolve: ((allow: boolean) => void) | null = null;

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

  protected onSubmit(value: EvaluationFormValue): void {
    void this.createEvaluation(value).then((created) => {
      void this.router.navigate(['/evaluations', created.id, 'edit']);
    });
  }

  protected onGeneratePrompt(): void {
    const form = this.evaluationForm();

    if (!form) {
      return;
    }

    if (!form.isTitleValid()) {
      form.markAllAsTouched();
      this.feedback.error('Enter a valid title (at least 3 characters) before generating a prompt.');
      return;
    }

    const title = form.getValue().title;
    this.generatingPrompt.set(true);

    void this.evaluationService
      .generatePrompt(title, {
        success: 'Prompt generated.',
        error: 'Could not generate prompt.',
      })
      .then((prompt) => {
        form.setPrompt(prompt);
      })
      .catch(() => undefined)
      .finally(() => {
        this.generatingPrompt.set(false);
      });
  }

  protected onRunFullAutomation(): void {
    const form = this.evaluationForm();

    if (!form) {
      return;
    }

    if (!form.isFormValid()) {
      form.markAllAsTouched();
      this.feedback.error('Please enter a valid title and prompt before running automation.');
      return;
    }

    if (this.creating() || this.automating()) {
      return;
    }

    this.creating.set(true);

    void this.createEvaluation(form.getValue())
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

    this.pendingLeaveResolve?.(true);
    this.pendingLeaveResolve = null;
  }

  protected onLeaveCancelled(): void {
    this.pendingLeaveResolve?.(false);
    this.pendingLeaveResolve = null;
  }

  private createEvaluation(value: EvaluationFormValue): Promise<Evaluation> {
    return this.evaluationService.create(value, {
      success: 'Evaluation created.',
      error: 'Could not create evaluation.',
    });
  }
}
