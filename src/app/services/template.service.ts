import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  CreateEvaluationTemplateDto,
  EvaluationRunEstimate,
  EvaluationTemplate,
} from '../models';
import { FeedbackService } from './feedback.service';
import { messageFromHttpError } from './http-error-message';

const API = '/api/evaluation-templates';

@Injectable({
  providedIn: 'root',
})
export class TemplateService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(FeedbackService);

  private readonly templatesSignal = signal<EvaluationTemplate[]>([]);

  readonly templates = this.templatesSignal.asReadonly();

  loadFromApi(): Promise<void> {
    return firstValueFrom(this.http.get<EvaluationTemplate[]>(API))
      .then((templates) => {
        this.templatesSignal.set(templates);
      })
      .catch(() => {
        this.templatesSignal.set([]);
      });
  }

  create(dto: CreateEvaluationTemplateDto): Promise<EvaluationTemplate> {
    return firstValueFrom(this.http.post<EvaluationTemplate>(API, dto))
      .then((saved) => {
        this.templatesSignal.update((list) => [saved, ...list]);
        this.feedback.success('Template saved.');
        return saved;
      })
      .catch((error) => {
        this.feedback.error(messageFromHttpError(error, 'Could not save template.'));
        throw error;
      });
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete(`${API}/${id}`))
      .then(() => {
        this.templatesSignal.update((list) => list.filter((template) => template.id !== id));
        this.feedback.success('Template deleted.');
      })
      .catch((error) => {
        this.feedback.error(messageFromHttpError(error, 'Could not delete template.'));
        throw error;
      });
  }
}

export function estimateEvaluation(
  http: HttpClient,
  payload: Record<string, unknown>,
): Promise<EvaluationRunEstimate> {
  return firstValueFrom(
    http.post<EvaluationRunEstimate>('/api/evaluations/estimate', payload),
  );
}
