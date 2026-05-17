import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EmptyState } from '../../components/empty-state/empty-state';
import { ImprovedAnswerEditor } from '../../components/improved-answer-editor/improved-answer-editor';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-improved-answer-page',
  imports: [RouterLink, ImprovedAnswerEditor, EmptyState],
  templateUrl: './improved-answer-page.html',
  styleUrl: './improved-answer-page.css',
})
export class ImprovedAnswerPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));

  protected onSave(improvedAnswer: string): void {
    this.evaluationService.update(this.evaluationId, { improvedAnswer });
  }
}
