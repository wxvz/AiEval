import { Injectable, computed, signal } from '@angular/core';

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

const STORAGE_KEY = 'ai-eval-evaluations';

@Injectable({
  providedIn: 'root',
})
export class EvaluationService {
  private readonly evaluationsSignal = signal<Evaluation[]>(this.loadFromStorage());

  readonly evaluations = this.evaluationsSignal.asReadonly();

  readonly count = computed(() => this.evaluationsSignal().length);

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

    this.persist([evaluation, ...this.evaluationsSignal()]);
    return evaluation;
  }

  update(id: string, dto: UpdateEvaluationDto): Evaluation | undefined {
    let updated: Evaluation | undefined;

    const next = this.evaluationsSignal().map((evaluation) => {
      if (evaluation.id !== id) {
        return evaluation;
      }

      updated = {
        ...evaluation,
        ...dto,
        title: dto.title?.trim() ?? evaluation.title,
        prompt: dto.prompt?.trim() ?? evaluation.prompt,
        updatedAt: new Date().toISOString(),
      };

      return updated;
    });

    if (!updated) {
      return undefined;
    }

    this.persist(next);
    return updated;
  }

  delete(id: string): boolean {
    const next = this.evaluationsSignal().filter((evaluation) => evaluation.id !== id);

    if (next.length === this.evaluationsSignal().length) {
      return false;
    }

    this.persist(next);
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
    let found = false;

    const next = this.evaluationsSignal().map((evaluation) => {
      if (evaluation.id !== evaluationId) {
        return evaluation;
      }

      found = true;
      return {
        ...evaluation,
        answers: updater(evaluation.answers),
        updatedAt: new Date().toISOString(),
      };
    });

    if (!found) {
      return false;
    }

    this.persist(next);
    return true;
  }

  private persist(evaluations: Evaluation[]): void {
    this.evaluationsSignal.set(evaluations);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(evaluations));
  }

  private loadFromStorage(): Evaluation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as Evaluation[];

      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
