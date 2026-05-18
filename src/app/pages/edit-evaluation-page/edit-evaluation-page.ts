import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AnswerCard } from '../../components/answer-card/answer-card';
import { AnswerForm, AnswerFormValue } from '../../components/answer-form/answer-form';
import { ConfirmDeleteModal } from '../../components/confirm-delete-modal/confirm-delete-modal';
import { CriterionCard } from '../../components/criterion-card/criterion-card';
import { CriterionForm, CriterionFormValue } from '../../components/criterion-form/criterion-form';
import { EmptyState } from '../../components/empty-state/empty-state';
import {
  EvaluationForm,
  EvaluationFormValue,
} from '../../components/evaluation-form/evaluation-form';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import { automationProgressLabel, CriteriaMode } from '../../models';
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
  ],
  templateUrl: './edit-evaluation-page.html',
  styleUrl: './edit-evaluation-page.css',
})
export class EditEvaluationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly automating = signal(false);
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

  protected onStopAutomation(): void {
    this.evaluationService.cancelAutomation(this.evaluationId);
    this.automating.set(false);
    this.progressSteps.update((steps) => [...steps, 'Automation stopped.']);
  }

  private async runAutomate(force: boolean): Promise<void> {
    this.automating.set(true);
    this.progressSteps.set(['Starting automation…']);

    try {
      await this.evaluationService.automate(
        this.evaluationId,
        { force },
        {
          onProgress: (event) => {
            this.progressSteps.update((steps) => [...steps, automationProgressLabel(event)]);
          },
          operationFeedback: {
            success: 'Automated evaluation complete.',
            error: 'Automation failed.',
          },
        },
      );
    } catch {
      // feedback handled in service
    } finally {
      this.automating.set(false);
    }
  }
}
