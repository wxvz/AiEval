import { Component, computed, HostListener, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AnswerCard } from '../../components/answer-card/answer-card';
import { AnswerForm, AnswerFormValue } from '../../components/answer-form/answer-form';
import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import { ConfirmDeleteModal } from '../../components/confirm-delete-modal/confirm-delete-modal';
import { CriterionCard } from '../../components/criterion-card/criterion-card';
import { CriterionForm, CriterionFormValue } from '../../components/criterion-form/criterion-form';
import { EmptyState } from '../../components/empty-state/empty-state';
import {
  EvaluationForm,
  EvaluationFormValue,
} from '../../components/evaluation-form/evaluation-form';
import { LeaveDuringAutomationPrompt } from '../../guards/leave-during-automation-prompt';
import { CriteriaMode } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';

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
    ConfirmDeleteModal,
    AutomationControlsComponent,
  ],
  templateUrl: './edit-evaluation-page.html',
  styleUrl: './edit-evaluation-page.css',
})
export class EditEvaluationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  private readonly leavePrompt = new LeaveDuringAutomationPrompt();

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly automating = computed(() =>
    this.evaluationService.isAutomating(this.evaluationId),
  );
  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));
  protected readonly activeCriteria = computed(() => {
    const current = this.evaluation();

    return current ? this.evaluationService.getActiveCriteria(current) : [];
  });

  protected readonly criteriaMode = computed(
    () => this.evaluation()?.criteriaMode ?? 'default',
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

    return this.leavePrompt.prompt();
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

  protected onLeaveConfirmed(): void {
    this.evaluationService.cancelAutomation(this.evaluationId);
    this.leavePrompt.confirmLeave();
  }

  protected onLeaveCancelled(): void {
    this.leavePrompt.cancelLeave();
  }
}
