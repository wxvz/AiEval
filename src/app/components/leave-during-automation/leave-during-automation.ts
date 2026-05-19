import { Component, inject, input } from '@angular/core';

import { ConfirmDeleteModal } from '../confirm-delete-modal/confirm-delete-modal';
import {
  CONFIRM_LEAVE_DURING_AUTOMATION_MODAL_ID,
  LeaveDuringAutomationPrompt,
} from '../../guards/leave-during-automation-prompt';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-leave-during-automation',
  imports: [ConfirmDeleteModal],
  templateUrl: './leave-during-automation.html',
})
export class LeaveDuringAutomationComponent {
  private readonly evaluationService = inject(EvaluationService);
  private readonly leavePrompt = new LeaveDuringAutomationPrompt();

  readonly evaluationId = input<string | null>(null);

  protected readonly modalId = CONFIRM_LEAVE_DURING_AUTOMATION_MODAL_ID;

  prompt(): Promise<boolean> {
    return this.leavePrompt.prompt(this.modalId);
  }

  protected onLeaveConfirmed(): void {
    const id = this.evaluationId();

    if (id) {
      this.evaluationService.cancelAutomation(id);
    }

    this.leavePrompt.confirmLeave();
  }

  protected onLeaveCancelled(): void {
    this.leavePrompt.cancelLeave();
  }
}
