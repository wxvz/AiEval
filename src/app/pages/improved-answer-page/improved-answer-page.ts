import { Component, computed, HostListener, inject, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import { EmptyState } from '../../components/empty-state/empty-state';
import { ImprovedAnswerEditor } from '../../components/improved-answer-editor/improved-answer-editor';
import { LeaveDuringAutomationComponent } from '../../components/leave-during-automation/leave-during-automation';
import { TokenUsageBadge } from '../../components/token-usage-badge/token-usage-badge';
import { ImprovedAnswer } from '../../models/improved-answer.model';
import { EvaluationService } from '../../services/evaluation.service';
import { useAutomationPageContext } from '../../utils/automation-page-context';

@Component({
  selector: 'app-improved-answer-page',
  imports: [
    RouterLink,
    ImprovedAnswerEditor,
    EmptyState,
    AutomationControlsComponent,
    LeaveDuringAutomationComponent,
    TokenUsageBadge,
  ],
  templateUrl: './improved-answer-page.html',
  styleUrl: './improved-answer-page.css',
})
export class ImprovedAnswerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  private readonly leaveDuringAutomation = viewChild(LeaveDuringAutomationComponent);

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly automationPage = useAutomationPageContext(() => this.evaluationId);

  protected readonly automating = this.automationPage.automating;
  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));
  protected readonly displayTokenUsage = this.automationPage.displayTokenUsage;
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
    if (this.automating()) {
      return;
    }

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
