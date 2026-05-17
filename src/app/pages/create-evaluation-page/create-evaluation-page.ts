import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { EvaluationForm, EvaluationFormValue } from '../../components/evaluation-form/evaluation-form';
import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-create-evaluation-page',
  imports: [EvaluationForm],
  templateUrl: './create-evaluation-page.html',
  styleUrl: './create-evaluation-page.css',
})
export class CreateEvaluationPage {
  private readonly evaluationService = inject(EvaluationService);
  private readonly router = inject(Router);

  protected onSubmit(value: EvaluationFormValue): void {
    void this.evaluationService.create(value).then((created) => {
      void this.router.navigate(['/evaluations', created.id, 'edit']);
    });
  }
}
