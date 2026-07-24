import { Component, computed, HostListener, inject, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { useAutomationPageContext } from '../../utils/automation-page-context';

import { AnswerCard } from '../../components/answer-card/answer-card';
import { AnswerForm, AnswerFormValue } from '../../components/answer-form/answer-form';
import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import { CriterionCard } from '../../components/criterion-card/criterion-card';
import { CriterionForm, CriterionFormValue } from '../../components/criterion-form/criterion-form';
import { EmptyState } from '../../components/empty-state/empty-state';
import {
  EvaluationForm,
  EvaluationFormValue,
} from '../../components/evaluation-form/evaluation-form';
import { LeaveDuringAutomationComponent } from '../../components/leave-during-automation/leave-during-automation';
import { TokenUsageBadge } from '../../components/token-usage-badge/token-usage-badge';
import { CriteriaMode } from '../../models';
import { LearnHandoffService } from '../../learn/learn-handoff.service';
import { getLesson } from '../../learn/curriculum';
import { EvaluationService } from '../../services/evaluation.service';
import { TemplateService } from '../../services/template.service';

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
    AutomationControlsComponent,
    LeaveDuringAutomationComponent,
    TokenUsageBadge,
  ],
  templateUrl: './edit-evaluation-page.html',
  styleUrl: './edit-evaluation-page.css',
})
export class EditEvaluationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);
  private readonly templateService = inject(TemplateService);
  private readonly learnHandoff = inject(LearnHandoffService);

  private readonly leaveDuringAutomation = viewChild(LeaveDuringAutomationComponent);

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly automationPage = useAutomationPageContext(() => this.evaluationId);

  protected readonly automating = this.automationPage.automating;
  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));
  protected readonly showLearnBackLink = computed(() => {
    this.learnHandoff.highlightedEvaluationId();
    return this.learnHandoff.lessonIdForEvaluation(this.evaluationId) !== null;
  });
  protected readonly learnLabRoute = computed(() => {
    const lessonId = this.learnHandoff.lessonIdForEvaluation(this.evaluationId);
    if (!lessonId) {
      return '/learn';
    }
    return getLesson(lessonId)?.route ?? '/learn';
  });
  protected readonly displayTokenUsage = this.automationPage.displayTokenUsage;
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

    return this.leaveDuringAutomation()?.prompt() ?? true;
  }

  protected onEvaluationSubmit(value: EvaluationFormValue): void {
    if (this.automating()) {
      return;
    }

    this.evaluationService.update(this.evaluationId, value, {
      success: 'Changes saved.',
      error: 'Could not save changes.',
    });
  }

  protected setCriteriaMode(criteriaMode: CriteriaMode): void {
    if (this.automating()) {
      return;
    }

    this.evaluationService.setCriteriaMode(this.evaluationId, criteriaMode, {
      success:
        criteriaMode === 'default' ? 'Using default criteria.' : 'Using custom criteria.',
      error: 'Could not update criteria mode.',
    });
  }

  protected onCriterionSubmit(value: CriterionFormValue): void {
    if (this.automating()) {
      return;
    }

    this.evaluationService.addCriterion(
      this.evaluationId,
      {
        name: value.name,
        maxPoints: value.maxPoints,
        weight: value.weight,
        ...(value.description.trim() ? { description: value.description } : {}),
      },
      {
        success: 'Criterion added.',
        error: 'Could not add criterion.',
      },
    );
  }

  protected removeCriterion(criterionId: string): void {
    if (this.automating()) {
      return;
    }

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
    if (this.automating()) {
      return;
    }

    this.evaluationService.addAnswer(this.evaluationId, value, {
      success: 'Model answer added.',
      error: 'Could not add model answer.',
    });
  }

  protected removeAnswer(answerId: string): void {
    if (this.automating()) {
      return;
    }

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

  protected saveAsTemplate(): void {
    const current = this.evaluation();

    if (!current) {
      return;
    }

    const name = window.prompt('Template name');

    if (!name?.trim()) {
      return;
    }

    void this.templateService.create({
      name: name.trim(),
      title: current.title,
      prompt: current.prompt,
      criteriaMode: current.criteriaMode,
      criteria: current.criteria,
      evaluationConfig: current.evaluationConfig,
    });
  }

}
