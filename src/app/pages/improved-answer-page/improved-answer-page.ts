import { Component, computed, HostListener, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import { ConfirmDeleteModal } from '../../components/confirm-delete-modal/confirm-delete-modal';
import { EmptyState } from '../../components/empty-state/empty-state';
import { ImprovedAnswerEditor } from '../../components/improved-answer-editor/improved-answer-editor';
import { ImprovedAnswer } from '../../models/improved-answer.model';
import { EvaluationService } from '../../services/evaluation.service';

declare const bootstrap: {
  Modal: {
    getOrCreateInstance: (element: Element) => { show: () => void; hide: () => void };
  };
};

@Component({
  selector: 'app-improved-answer-page',
  imports: [
    RouterLink,
    ImprovedAnswerEditor,
    EmptyState,
    AutomationControlsComponent,
    ConfirmDeleteModal,
  ],
  templateUrl: './improved-answer-page.html',
  styleUrl: './improved-answer-page.css',
})
export class ImprovedAnswerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  private pendingLeaveResolve: ((allow: boolean) => void) | null = null;

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly automating = computed(() =>
    this.evaluationService.isAutomating(this.evaluationId),
  );
  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));
  protected readonly hasWinner = computed(
    () =>
      !!this.evaluation()?.winnerAnswerId ||
      !!this.evaluation()?.answers?.some((answer) => answer.isWinner),
  );

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

  protected onSave(improvedAnswer: ImprovedAnswer): void {
    this.evaluationService.update(
      this.evaluationId,
      { improvedAnswer },
      {
        success: 'Improved answer saved.',
        error: 'Could not save improved answer.',
      },
    );
  }

  protected onLeaveConfirmed(): void {
    this.evaluationService.cancelAutomation(this.evaluationId);
    this.pendingLeaveResolve?.(true);
    this.pendingLeaveResolve = null;
  }

  protected onLeaveCancelled(): void {
    this.pendingLeaveResolve?.(false);
    this.pendingLeaveResolve = null;
  }
}
