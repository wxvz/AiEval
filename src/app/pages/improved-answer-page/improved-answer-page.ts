import { Component, computed, HostListener, inject, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import { EmptyState } from '../../components/empty-state/empty-state';
import { ImprovedAnswerEditor } from '../../components/improved-answer-editor/improved-answer-editor';
import { LeaveDuringAutomationComponent } from '../../components/leave-during-automation/leave-during-automation';
import { ImprovedAnswer } from '../../models/improved-answer.model';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-improved-answer-page',
  imports: [
    RouterLink,
    ImprovedAnswerEditor,
    EmptyState,
    AutomationControlsComponent,
    LeaveDuringAutomationComponent,
  ],
  templateUrl: './improved-answer-page.html',
  styleUrl: './improved-answer-page.css',
})
export class ImprovedAnswerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  private readonly leaveDuringAutomation = viewChild(LeaveDuringAutomationComponent);

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

    return this.leaveDuringAutomation()?.prompt() ?? true;
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

}
