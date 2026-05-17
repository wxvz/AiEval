import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  Answer,
  CriteriaMode,
  CreateAnswerDto,
  CreateCriterionDto,
  CreateEvaluationDto,
  DEFAULT_CRITERIA,
  Evaluation,
  RubricCriterion,
  UpdateEvaluationDto,
} from '../models';

const API = '/api/evaluations';

@Injectable({
  providedIn: 'root',
})
export class EvaluationService {
  private readonly http = inject(HttpClient);

  private readonly evaluationsSignal = signal<Evaluation[]>([]);
  private readonly loadingSignal = signal(true);
  private readonly loadErrorSignal = signal<string | null>(null);

  readonly evaluations = this.evaluationsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();

  readonly count = computed(() => this.evaluationsSignal().length);

  loadFromApi(): Promise<void> {
    this.loadingSignal.set(true);
    this.loadErrorSignal.set(null);

    return firstValueFrom(this.http.get<Evaluation[]>(API))
      .then((evaluations) => {
        this.evaluationsSignal.set(evaluations);
      })
      .catch(() => {
        this.loadErrorSignal.set('Could not load evaluations from the server.');
        this.evaluationsSignal.set([]);
      })
      .finally(() => {
        this.loadingSignal.set(false);
      });
  }

  getAll(): Evaluation[] {
    return this.evaluationsSignal();
  }

  getById(id: string): Evaluation | undefined {
    return this.evaluationsSignal().find((evaluation) => evaluation.id === id);
  }

  getActiveCriteria(evaluation: Evaluation): RubricCriterion[] {
    return evaluation.criteriaMode === 'default' ? DEFAULT_CRITERIA : evaluation.criteria;
  }

  setCriteriaMode(id: string, criteriaMode: CriteriaMode): Evaluation | undefined {
    return this.update(id, { criteriaMode });
  }

  create(dto: CreateEvaluationDto): Evaluation {
    const now = new Date().toISOString();
    const evaluation: Evaluation = {
      id: crypto.randomUUID(),
      title: dto.title.trim(),
      prompt: dto.prompt.trim(),
      criteriaMode: 'default',
      criteria: dto.criteria ?? [],
      answers: [],
      createdAt: now,
      updatedAt: now,
    };

    this.evaluationsSignal.update((list) => [evaluation, ...list]);
    this.http.post<Evaluation>(API, evaluation).subscribe({
      next: (saved) => this.replaceEvaluation(saved),
      error: () => this.removeEvaluationFromList(evaluation.id),
    });

    return evaluation;
  }

  update(id: string, dto: UpdateEvaluationDto): Evaluation | undefined {
    const current = this.getById(id);

    if (!current) {
      return undefined;
    }

    const updated: Evaluation = {
      ...current,
      ...dto,
      title: dto.title?.trim() ?? current.title,
      prompt: dto.prompt?.trim() ?? current.prompt,
      updatedAt: new Date().toISOString(),
    };

    this.replaceEvaluation(updated);
    this.http.put<Evaluation>(`${API}/${id}`, updated).subscribe({
      next: (saved) => this.replaceEvaluation(saved),
      error: () => this.replaceEvaluation(current),
    });

    return updated;
  }

  delete(id: string): boolean {
    const current = this.getById(id);

    if (!current) {
      return false;
    }

    this.removeEvaluationFromList(id);
    this.http.delete(`${API}/${id}`).subscribe({
      error: () => this.replaceEvaluation(current),
    });

    return true;
  }

  addCriterion(evaluationId: string, dto: CreateCriterionDto): RubricCriterion | undefined {
    const description = dto.description?.trim();

    const criterion: RubricCriterion = {
      id: crypto.randomUUID(),
      name: dto.name.trim(),
      maxPoints: dto.maxPoints,
      ...(description ? { description } : {}),
    };

    const evaluation = this.getById(evaluationId);

    if (!evaluation) {
      return undefined;
    }

    return this.update(evaluationId, {
      criteria: [...evaluation.criteria, criterion],
    })
      ? criterion
      : undefined;
  }

  addAnswer(evaluationId: string, dto: CreateAnswerDto): Answer | undefined {
    const answer: Answer = {
      id: crypto.randomUUID(),
      evaluationId,
      label: dto.label.trim(),
      content: dto.content.trim(),
      scores: [],
    };

    return this.updateEvaluationAnswers(evaluationId, (answers) => [...answers, answer])
      ? answer
      : undefined;
  }

  updateAnswer(
    evaluationId: string,
    answerId: string,
    partial: Partial<Pick<Answer, 'label' | 'content' | 'scores' | 'isWinner'>>,
  ): Answer | undefined {
    let updated: Answer | undefined;

    const changed = this.updateEvaluationAnswers(evaluationId, (answers) =>
      answers.map((answer) => {
        if (answer.id !== answerId) {
          return answer;
        }

        updated = {
          ...answer,
          ...partial,
          label: partial.label?.trim() ?? answer.label,
          content: partial.content?.trim() ?? answer.content,
        };

        return updated;
      }),
    );

    return changed ? updated : undefined;
  }

  setWinner(evaluationId: string, answerId: string): Evaluation | undefined {
    const evaluation = this.getById(evaluationId);

    if (!evaluation?.answers.some((answer) => answer.id === answerId)) {
      return undefined;
    }

    return this.update(evaluationId, {
      winnerAnswerId: answerId,
      answers: evaluation.answers.map((answer) => ({
        ...answer,
        isWinner: answer.id === answerId,
      })),
    });
  }

  private updateEvaluationAnswers(
    evaluationId: string,
    updater: (answers: Answer[]) => Answer[],
  ): boolean {
    const evaluation = this.getById(evaluationId);

    if (!evaluation) {
      return false;
    }

    return !!this.update(evaluationId, {
      answers: updater(evaluation.answers),
    });
  }

  private replaceEvaluation(evaluation: Evaluation): void {
    this.evaluationsSignal.update((list) => {
      const index = list.findIndex((item) => item.id === evaluation.id);

      if (index === -1) {
        return [evaluation, ...list];
      }

      const next = [...list];
      next[index] = evaluation;
      return next;
    });
  }

  private removeEvaluationFromList(id: string): void {
    this.evaluationsSignal.update((list) => list.filter((evaluation) => evaluation.id !== id));
  }
}
