import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import {
  Answer,
  AutomationPhase,
  AutomationProgressEvent,
  AutomationRunStatus,
  CriteriaMode,
  CreateAnswerDto,
  CreateCriterionDto,
  CreateEvaluationDto,
  DEFAULT_CRITERIA,
  Evaluation,
  initialScoresForCriteria,
  RubricCriterion,
  UpdateEvaluationDto,
} from '../models';
import { FeedbackService } from './feedback.service';
import { messageFromHttpError } from './http-error-message';
import { SettingsService } from './settings.service';

const API = '/api/evaluations';

export interface OperationFeedback {
  success: string;
  error: string;
}

@Injectable({
  providedIn: 'root',
})
export class EvaluationService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(FeedbackService);
  private readonly ngZone = inject(NgZone);
  private readonly settings = inject(SettingsService);

  private readonly evaluationsSignal = signal<Evaluation[]>([]);
  private readonly loadingSignal = signal(true);
  private readonly loadErrorSignal = signal<string | null>(null);

  readonly evaluations = this.evaluationsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();

  readonly count = computed(() => this.evaluationsSignal().length);

  readonly automatingEvaluationId = signal<string | null>(null);

  isAutomating(evaluationId?: string): boolean {
    const id = this.automatingEvaluationId();

    return evaluationId ? id === evaluationId : id !== null;
  }

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

  setCriteriaMode(
    id: string,
    criteriaMode: CriteriaMode,
    operationFeedback?: OperationFeedback,
  ): Evaluation | undefined {
    return this.update(id, { criteriaMode }, operationFeedback);
  }

  generateTitle(operationFeedback?: OperationFeedback): Promise<string> {
    return firstValueFrom(this.http.post<{ title: string }>(`${API}/generate-title`, {}))
      .then((response) => {
        if (operationFeedback) {
          this.feedback.success(operationFeedback.success);
        }
        return response.title;
      })
      .catch((error) => {
        if (operationFeedback) {
          this.feedback.error(messageFromHttpError(error, operationFeedback.error));
        }
        throw new Error(
          messageFromHttpError(error, operationFeedback?.error ?? 'Could not generate title.'),
        );
      });
  }

  generatePrompt(title: string, operationFeedback?: OperationFeedback): Promise<string> {
    return firstValueFrom(
      this.http.post<{ prompt: string }>(`${API}/generate-prompt`, { title: title.trim() }),
    )
      .then((response) => {
        if (operationFeedback) {
          this.feedback.success(operationFeedback.success);
        }
        return response.prompt;
      })
      .catch((error) => {
        if (operationFeedback) {
          this.feedback.error(messageFromHttpError(error, operationFeedback.error));
        }
        throw new Error(
          messageFromHttpError(error, operationFeedback?.error ?? 'Could not generate prompt.'),
        );
      });
  }

  create(dto: CreateEvaluationDto, operationFeedback?: OperationFeedback): Promise<Evaluation> {
    return firstValueFrom(
      this.http.post<Evaluation>(API, {
        title: dto.title.trim(),
        prompt: dto.prompt.trim(),
        criteriaMode: dto.criteriaMode ?? this.settings.defaultCriteriaMode(),
        ...(dto.criteria ? { criteria: dto.criteria } : {}),
      }),
    )
      .then((saved) => {
        this.evaluationsSignal.update((list) => [saved, ...list]);
        if (operationFeedback) {
          this.feedback.success(operationFeedback.success);
        }
        return saved;
      })
      .catch((error) => {
        if (operationFeedback) {
          this.feedback.error(messageFromHttpError(error, operationFeedback.error));
        }
        throw new Error(
          messageFromHttpError(error, operationFeedback?.error ?? 'Could not create evaluation.'),
        );
      });
  }

  update(
    id: string,
    dto: UpdateEvaluationDto,
    operationFeedback?: OperationFeedback,
  ): Evaluation | undefined {
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
      next: (saved) => {
        this.replaceEvaluation(saved);
        if (operationFeedback) {
          this.feedback.success(operationFeedback.success);
        }
      },
      error: (error) => {
        this.replaceEvaluation(current);
        if (operationFeedback) {
          this.feedback.error(messageFromHttpError(error, operationFeedback.error));
        }
      },
    });

    return updated;
  }

  delete(id: string, operationFeedback?: OperationFeedback): boolean {
    const current = this.getById(id);

    if (!current) {
      return false;
    }

    this.removeEvaluationFromList(id);
    this.http.delete(`${API}/${id}`).subscribe({
      next: () => {
        if (operationFeedback) {
          this.feedback.success(operationFeedback.success);
        }
      },
      error: (error) => {
        this.replaceEvaluation(current);
        if (operationFeedback) {
          this.feedback.error(messageFromHttpError(error, operationFeedback.error));
        }
      },
    });

    return true;
  }

  addCriterion(
    evaluationId: string,
    dto: CreateCriterionDto,
    operationFeedback?: OperationFeedback,
  ): RubricCriterion | undefined {
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

    return this.update(
      evaluationId,
      {
        criteria: [...evaluation.criteria, criterion],
      },
      operationFeedback,
    )
      ? criterion
      : undefined;
  }

  addAnswer(
    evaluationId: string,
    dto: CreateAnswerDto,
    operationFeedback?: OperationFeedback,
  ): Answer | undefined {
    const evaluation = this.getById(evaluationId);

    if (!evaluation) {
      return undefined;
    }

    const answer: Answer = {
      id: crypto.randomUUID(),
      evaluationId,
      label: dto.label.trim(),
      content: dto.content.trim(),
      scores: initialScoresForCriteria(this.getActiveCriteria(evaluation)),
    };

    return this.updateEvaluationAnswers(
      evaluationId,
      (answers) => [...answers, answer],
      operationFeedback,
    )
      ? answer
      : undefined;
  }

  updateAnswer(
    evaluationId: string,
    answerId: string,
    partial: Partial<Pick<Answer, 'label' | 'content' | 'scores' | 'isWinner' | 'notes'>>,
    operationFeedback?: OperationFeedback,
  ): Answer | undefined {
    let updated: Answer | undefined;

    const changed = this.updateEvaluationAnswers(
      evaluationId,
      (answers) =>
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
      operationFeedback,
    );

    return changed ? updated : undefined;
  }

  private activeAutomation: {
    evaluationId: string;
    eventSource: EventSource;
    runState: { cancelledByUser: boolean };
    runId?: string;
    clearTimer: () => void;
    abort: () => void;
  } | null = null;

  private clearActiveAutomation(): void {
    this.activeAutomation = null;
    this.automatingEvaluationId.set(null);
  }

  private disposeActiveAutomation(notifyServer: boolean): void {
    const active = this.activeAutomation;

    if (!active) {
      return;
    }

    const { evaluationId, runId, abort } = active;

    if (notifyServer) {
      active.runState.cancelledByUser = true;
    }

    abort();

    if (notifyServer && runId) {
      void firstValueFrom(
        this.http.post<{ cancelled: boolean }>(`${API}/${evaluationId}/automate/cancel`, {
          runId,
        }),
      ).catch(() => {
        // no active server run (already finished or never started)
      });
    }
  }

  cancelAutomation(evaluationId: string): void {
    if (this.activeAutomation?.evaluationId === evaluationId) {
      this.disposeActiveAutomation(true);
    }
  }

  automate(
    evaluationId: string,
    options: { force?: boolean; phase?: AutomationPhase } = {},
    callbacks?: {
      onProgress?: (event: AutomationProgressEvent) => void;
      onStatus?: (status: AutomationRunStatus) => void;
      onSlowProviderPrompt?: (
        event: Extract<AutomationProgressEvent, { type: 'slow_provider_prompt' }>,
      ) => Promise<boolean>;
      operationFeedback?: OperationFeedback;
    },
  ): Promise<Evaluation> {
    const params = new URLSearchParams();

    if (options.force) {
      params.set('force', 'true');
    }

    if (options.phase && options.phase !== 'full') {
      params.set('phase', options.phase);
    }

    const url = `${API}/${evaluationId}/automate/stream?${params.toString()}`;

    return new Promise((resolve, reject) => {
      this.disposeActiveAutomation(true);

      const eventSource = new EventSource(url);
      const runState = { cancelledByUser: false };
      const timeoutMs = 10 * 60 * 1000;
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const clearTimer = () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      };

      const runInZone = (handler: () => void): void => {
        this.ngZone.run(handler);
      };

      const finish = (handler: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimer();

        if (this.activeAutomation?.eventSource === eventSource) {
          this.clearActiveAutomation();
          eventSource.close();
        }

        handler();
      };

      const abort = (): void => {
        runInZone(() => {
          finish(() => {
            callbacks?.onStatus?.('cancelled');
            reject(new Error('Automation cancelled.'));
          });
        });
      };

      this.activeAutomation = { evaluationId, eventSource, runState, clearTimer, abort };
      this.automatingEvaluationId.set(evaluationId);

      timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }

        finish(() => {
          const message = 'Automation timed out after 10 minutes.';
          callbacks?.onStatus?.('failed');
          if (callbacks?.operationFeedback) {
            this.feedback.error(message);
          }
          reject(new Error(message));
        });
      }, timeoutMs);

      eventSource.onmessage = (messageEvent) => {
        runInZone(() => {
          let event: AutomationProgressEvent;

          try {
            event = JSON.parse(messageEvent.data as string) as AutomationProgressEvent;
          } catch {
            return;
          }

          if ('runId' in event && typeof event.runId === 'string' && this.activeAutomation) {
            this.activeAutomation.runId = event.runId;
          }

          if (event.type === 'status') {
            callbacks?.onStatus?.(event.status);
            return;
          }

          if (event.type === 'complete') {
            try {
              callbacks?.onProgress?.(event);
            } finally {
              finish(() => {
                callbacks?.onStatus?.('completed');
                this.replaceEvaluation(event.evaluation);
                if (callbacks?.operationFeedback) {
                  this.feedback.success(callbacks.operationFeedback.success);
                }
                resolve(event.evaluation);
              });
            }
            return;
          }

          if (event.type === 'error') {
            try {
              callbacks?.onProgress?.(event);
            } finally {
              finish(() => {
                callbacks?.onStatus?.(event.status);
                const errorMessage = event.message;
                if (callbacks?.operationFeedback && event.status !== 'cancelled') {
                  this.feedback.error(errorMessage);
                }
                reject(new Error(errorMessage));
              });
            }
            return;
          }

          callbacks?.onProgress?.(event);

          if (event.type === 'slow_provider_prompt') {
            void (async () => {
              const runId = event.runId ?? this.activeAutomation?.runId;

              if (!runId) {
                finish(() => {
                  reject(new Error('Could not submit provider choice: missing run id.'));
                });
                return;
              }

              try {
                const useCloud = callbacks?.onSlowProviderPrompt
                  ? await this.ngZone.run(() => callbacks.onSlowProviderPrompt!(event))
                  : false;

                const response = await firstValueFrom(
                  this.http.post<{ accepted: boolean }>(
                    `${API}/${evaluationId}/automate/provider-choice`,
                    { useCloud, runId },
                  ),
                );

                if (!response.accepted) {
                  const message = 'Automation already ended; please run again.';
                  this.feedback.error(message);
                  finish(() => {
                    reject(new Error(message));
                  });
                }
              } catch {
                finish(() => {
                  reject(new Error('Could not submit provider choice.'));
                });
              }
            })();

            return;
          }
        });
      };

      eventSource.onerror = () => {
        runInZone(() => {
          finish(() => {
            if (runState.cancelledByUser) {
              callbacks?.onStatus?.('cancelled');
              reject(new Error('Automation cancelled.'));
              return;
            }

            callbacks?.onStatus?.('failed');
            const errorMessage =
              callbacks?.operationFeedback?.error ?? 'Automation connection failed.';
            if (callbacks?.operationFeedback) {
              this.feedback.error(errorMessage);
            }
            reject(new Error(errorMessage));
          });
        });
      };
    });
  }

  setWinner(
    evaluationId: string,
    answerId: string,
    operationFeedback?: OperationFeedback,
  ): Evaluation | undefined {
    const evaluation = this.getById(evaluationId);

    if (!evaluation?.answers.some((answer) => answer.id === answerId)) {
      return undefined;
    }

    return this.update(
      evaluationId,
      {
        winnerAnswerId: answerId,
        answers: evaluation.answers.map((answer) => ({
          ...answer,
          isWinner: answer.id === answerId,
        })),
      },
      operationFeedback,
    );
  }

  private updateEvaluationAnswers(
    evaluationId: string,
    updater: (answers: Answer[]) => Answer[],
    operationFeedback?: OperationFeedback,
  ): boolean {
    const evaluation = this.getById(evaluationId);

    if (!evaluation) {
      return false;
    }

    return !!this.update(
      evaluationId,
      {
        answers: updater(evaluation.answers),
      },
      operationFeedback,
    );
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
