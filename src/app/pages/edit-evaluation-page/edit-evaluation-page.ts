import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AnswerCard } from '../../components/answer-card/answer-card';
import { AnswerForm, AnswerFormValue } from '../../components/answer-form/answer-form';
import { EmptyState } from '../../components/empty-state/empty-state';
import { EvaluationForm, EvaluationFormValue } from '../../components/evaluation-form/evaluation-form';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-edit-evaluation-page',
  imports: [RouterLink, EvaluationForm, AnswerForm, AnswerCard, EmptyState],
  templateUrl: './edit-evaluation-page.html',
  styleUrl: './edit-evaluation-page.css',
})
export class EditEvaluationPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));

  protected onEvaluationSubmit(value: EvaluationFormValue): void {
    this.evaluationService.update(this.evaluationId, value);
  }

  protected onAnswerSubmit(value: AnswerFormValue): void {
    this.evaluationService.addAnswer(this.evaluationId, value);
  }

  protected removeAnswer(answerId: string): void {
    const current = this.evaluation();

    if (!current) {
      return;
    }

    this.evaluationService.update(this.evaluationId, {
      answers: current.answers.filter((answer) => answer.id !== answerId),
    });
  }
}
