import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';

import {
  Answer,
  AutomationPhase,
  AutomationProgressEvent,
  AutomationRunStatus,
  CriteriaMode,
  TokenUsageTotals,
  CreateAnswerDto,
  CreateCriterionDto,
  CreateEvaluationDto,
  DEFAULT_CRITERIA,
  DEFAULT_EVALUATION_CONFIG,
  Evaluation,
  EvaluationConfig,
  EvaluationRunEstimate,
  initialScoresForCriteria,
  ManualOverrideRecord,
  RubricCriterion,
  TaskDifficulty,
  UpdateEvaluationDto,
  upsertCriterionScore,
} from '../models';
import { FeedbackService } from './feedback.service';
import { messageFromHttpError } from './http-error-message';
import { ServerSettingsService } from './server-settings.service';
import { SettingsService } from './settings.service';
import { readStoredApiToken } from './api-token.storage';

const API = '/api/evaluations';

/** Matches server generate-title / evaluation-form title min length. */
export const MIN_GENERATED_TITLE_LENGTH = 3;
/** Matches server generate-prompt / evaluation-form prompt min length. */
export const MIN_GENERATED_PROMPT_LENGTH = 10;

export interface OperationFeedback {
  success: string;
  error: string;
}

function touchesAutomationOwnedFields(dto: UpdateEvaluationDto): boolean {
  return (
    dto.answers !== undefined ||
    dto.winnerAnswerId !== undefined ||
    Object.prototype.hasOwnProperty.call(dto, 'improvedAnswer')
  );
}

@Injectable({
  providedIn: 'root',
})
export class EvaluationService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(FeedbackService);
  private readonly ngZone = inject(NgZone);
  private readonly settings = inject(SettingsService);
  private readonly serverSettings = inject(ServerSettingsService);

  private readonly evaluationsSignal = signal<Evaluation[]>([]);
  private readonly loadingSignal = signal(true);
  private readonly loadErrorSignal = signal<string | null>(null);

  /** Serialize PUTs per evaluation id so concurrent edits do not last-write-win. */
  private readonly putChains = new Map<string, Promise<void>>();
  /** In-flight PUT subscriptions so automation completion can cancel stale writes. */
  private readonly putSubscriptions = new Map<string, Subscription>();

  readonly evaluations = this.evaluationsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly loadError = this.loadErrorSignal.asReadonly();

  readonly count = computed(() => this.evaluationsSignal().length);

  readonly automatingEvaluationId = signal<string | null>(null);
  /** Live token usage keyed by evaluation id (supports concurrent automate runs). */
  private readonly automationTokenUsageById = signal<ReadonlyMap<string, TokenUsageTotals>>(
    new Map(),
  );

  getAutomationTokenUsage(evaluationId: string): TokenUsageTotals | null {
    return this.automationTokenUsageById().get(evaluationId) ?? null;
  }

  /** Test helper — set or clear live usage for an evaluation. */
  setAutomationTokenUsageForTests(
    evaluationId: string,
    usage: TokenUsageTotals | null,
  ): void {
    this.patchAutomationTokenUsage(evaluationId, usage);
  }

  private patchAutomationTokenUsage(
    evaluationId: string,
    usage: TokenUsageTotals | null,
  ): void {
    this.automationTokenUsageById.update((current) => {
      const next = new Map(current);
      if (usage === null) {
        next.delete(evaluationId);
      } else {
        next.set(evaluationId, usage);
      }
      return next;
    });
  }

  isAutomating(evaluationId?: string): boolean {
    if (evaluationId) {
      return (
        this.activeAutomations.has(evaluationId) ||
        this.automatingEvaluationId() === evaluationId
      );
    }

    return this.activeAutomations.size > 0 || this.automatingEvaluationId() !== null;
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

  generateTitle(
    evaluationConfig: EvaluationConfig = DEFAULT_EVALUATION_CONFIG,
    operationFeedback?: OperationFeedback,
    options?: { signal?: AbortSignal },
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (options?.signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const subscription = this.http
        .post<{ title: string }>(`${API}/generate-title`, { evaluationConfig })
        .subscribe({
          next: (response) => {
            const title = typeof response?.title === 'string' ? response.title.trim() : '';

            if (title.length < MIN_GENERATED_TITLE_LENGTH) {
              const message = 'Generated title was too short. Try again.';
              if (operationFeedback) {
                this.feedback.error(operationFeedback.error || message);
              }
              reject(new Error(message));
              return;
            }

            if (operationFeedback?.success) {
              this.feedback.success(operationFeedback.success);
            }
            resolve(title);
          },
          error: (error) => {
            if (options?.signal?.aborted) {
              reject(error);
              return;
            }
            if (operationFeedback) {
              this.feedback.error(messageFromHttpError(error, operationFeedback.error));
            }
            reject(
              new Error(
                messageFromHttpError(error, operationFeedback?.error ?? 'Could not generate title.'),
              ),
            );
          },
        });

      options?.signal?.addEventListener(
        'abort',
        () => {
          subscription.unsubscribe();
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  }

  generatePrompt(
    title: string,
    evaluationConfig: EvaluationConfig = DEFAULT_EVALUATION_CONFIG,
    operationFeedback?: OperationFeedback,
    options?: { signal?: AbortSignal },
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (options?.signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      const subscription = this.http
        .post<{ prompt: string }>(`${API}/generate-prompt`, {
          title: title.trim(),
          evaluationConfig,
        })
        .subscribe({
          next: (response) => {
            const prompt = typeof response?.prompt === 'string' ? response.prompt.trim() : '';

            if (prompt.length < MIN_GENERATED_PROMPT_LENGTH) {
              const message = 'Generated prompt was too short. Try again or edit the title.';
              if (operationFeedback) {
                this.feedback.error(operationFeedback.error || message);
              }
              reject(new Error(message));
              return;
            }

            if (operationFeedback?.success) {
              this.feedback.success(operationFeedback.success);
            }
            resolve(prompt);
          },
          error: (error) => {
            if (options?.signal?.aborted) {
              reject(error);
              return;
            }
            if (operationFeedback) {
              this.feedback.error(messageFromHttpError(error, operationFeedback.error));
            }
            reject(
              new Error(
                messageFromHttpError(
                  error,
                  operationFeedback?.error ?? 'Could not generate prompt.',
                ),
              ),
            );
          },
        });

      options?.signal?.addEventListener(
        'abort',
        () => {
          subscription.unsubscribe();
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  }

  create(dto: CreateEvaluationDto, operationFeedback?: OperationFeedback): Promise<Evaluation> {
    const criteriaMode = this.resolveCreateCriteriaMode(dto);

    return firstValueFrom(
      this.http.post<Evaluation>(API, {
        title: dto.title.trim(),
        prompt: dto.prompt.trim(),
        criteriaMode,
        evaluationConfig: dto.evaluationConfig ?? DEFAULT_EVALUATION_CONFIG,
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

    if (this.isAutomating(id) && touchesAutomationOwnedFields(dto)) {
      if (operationFeedback) {
        this.feedback.error(
          operationFeedback.error ||
            'Automation is in progress. Wait for it to finish before editing answers.',
        );
      }
      return undefined;
    }

    const baseUpdatedAt = current.updatedAt;
    const optimistic: Evaluation = {
      ...current,
      ...dto,
      title: dto.title?.trim() ?? current.title,
      prompt: dto.prompt?.trim() ?? current.prompt,
      updatedAt: new Date().toISOString(),
    };

    this.replaceEvaluation(optimistic);
    this.enqueuePut(id, optimistic, baseUpdatedAt, current, operationFeedback);

    return optimistic;
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
      weight: dto.weight,
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

  private readonly activeAutomations = new Map<
    string,
    {
      evaluationId: string;
      eventSource: EventSource;
      runState: { cancelledByUser: boolean };
      runId?: string;
      clearTimer: () => void;
      abort: () => void;
    }
  >();

  private syncAutomatingEvaluationId(): void {
    if (this.activeAutomations.size === 0) {
      this.automatingEvaluationId.set(null);
      return;
    }

    // Prefer the most recently registered id (insertion order / last set).
    let lastId: string | null = null;
    for (const id of this.activeAutomations.keys()) {
      lastId = id;
    }
    this.automatingEvaluationId.set(lastId);
  }

  private clearActiveAutomation(evaluationId: string, eventSource?: EventSource): void {
    const active = this.activeAutomations.get(evaluationId);

    if (!active) {
      return;
    }

    if (eventSource && active.eventSource !== eventSource) {
      return;
    }

    this.activeAutomations.delete(evaluationId);
    this.syncAutomatingEvaluationId();
    this.cancelPendingPuts(evaluationId);
    this.patchAutomationTokenUsage(evaluationId, null);
  }

  private disposeActiveAutomation(evaluationId: string, notifyServer: boolean): void {
    const active = this.activeAutomations.get(evaluationId);

    if (!active) {
      return;
    }

    const { runId, abort, runState } = active;

    // Mark cancelled before abort so in-flight provider-choice POST is skipped.
    if (notifyServer) {
      runState.cancelledByUser = true;
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
    if (this.activeAutomations.has(evaluationId)) {
      this.disposeActiveAutomation(evaluationId, true);
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

    const apiToken = readStoredApiToken();
    if (apiToken) {
      params.set('api_token', apiToken);
    }

    const query = params.toString();
    const url = query
      ? `${API}/${evaluationId}/automate/stream?${query}`
      : `${API}/${evaluationId}/automate/stream`;

    return new Promise((resolve, reject) => {
      // Supersede only a prior run for the same evaluation — other evals can run in parallel.
      if (this.activeAutomations.has(evaluationId)) {
        this.disposeActiveAutomation(evaluationId, true);
      }

      const eventSource = new EventSource(url);
      const runState = { cancelledByUser: false };
      const timeoutMs = 10 * 60 * 1000;
      let settled = false;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let timeoutDeadline = 0;
      let remainingTimeoutMs = timeoutMs;
      let pausedForProviderChoice = false;

      const clearTimer = () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      };

      const armClientTimeout = (ms: number) => {
        clearTimer();
        remainingTimeoutMs = ms;
        timeoutDeadline = Date.now() + ms;
        timeoutId = setTimeout(() => {
          if (settled) {
            return;
          }

          const active = this.activeAutomations.get(evaluationId);

          if (active?.eventSource === eventSource && active.runId) {
            void firstValueFrom(
              this.http.post<{ cancelled: boolean }>(
                `${API}/${active.evaluationId}/automate/cancel`,
                { runId: active.runId },
              ),
            ).catch(() => {
              // no active server run (already finished or never started)
            });
          }

          finish(() => {
            const message = 'Automation timed out after 10 minutes.';
            callbacks?.onStatus?.('failed');
            if (callbacks?.operationFeedback) {
              this.feedback.error(message);
            }
            reject(new Error(message));
          });
        }, ms);
      };

      const pauseClientTimeoutForChoice = () => {
        if (timeoutId !== undefined) {
          remainingTimeoutMs = Math.max(0, timeoutDeadline - Date.now());
          clearTimer();
        }

        pausedForProviderChoice = true;
      };

      const resumeClientTimeoutAfterChoice = () => {
        if (!pausedForProviderChoice) {
          return;
        }

        pausedForProviderChoice = false;
        armClientTimeout(remainingTimeoutMs > 0 ? remainingTimeoutMs : timeoutMs);
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

        if (this.activeAutomations.get(evaluationId)?.eventSource === eventSource) {
          this.clearActiveAutomation(evaluationId, eventSource);
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

      const providerChoiceErrorMessage = (error: unknown): string => {
        const status = (error as { status?: number })?.status;
        const bodyMessage = messageFromHttpError(error, '');

        if (bodyMessage && typeof status === 'number') {
          return `Could not submit provider choice (${status}): ${bodyMessage}`;
        }

        if (bodyMessage) {
          return `Could not submit provider choice: ${bodyMessage}`;
        }

        if (typeof status === 'number') {
          return `Could not submit provider choice (${status}).`;
        }

        return 'Could not submit provider choice.';
      };

      const postProviderChoice = async (runId: string, useCloud: boolean): Promise<void> => {
        // Server returns 404/409 on failure; a 2xx body is always `{ accepted: true }`.
        await firstValueFrom(
          this.http.post<{ accepted: boolean }>(
            `${API}/${evaluationId}/automate/provider-choice`,
            { useCloud, runId },
          ),
        );
      };

      this.activeAutomations.set(evaluationId, {
        evaluationId,
        eventSource,
        runState,
        clearTimer,
        abort,
      });
      this.cancelPendingPuts(evaluationId);
      this.syncAutomatingEvaluationId();
      this.patchAutomationTokenUsage(
        evaluationId,
        this.getById(evaluationId)?.tokenUsage ?? null,
      );

      armClientTimeout(timeoutMs);

      eventSource.onmessage = (messageEvent) => {
        runInZone(() => {
          // Ignore late messages from a disposed/superseded EventSource.
          if (this.activeAutomations.get(evaluationId)?.eventSource !== eventSource) {
            return;
          }

          let event: AutomationProgressEvent;

          try {
            event = JSON.parse(messageEvent.data as string) as AutomationProgressEvent;
          } catch {
            const message = 'Automation received an invalid progress event.';
            finish(() => {
              callbacks?.onStatus?.('failed');
              if (callbacks?.operationFeedback) {
                this.feedback.error(message);
              }
              reject(new Error(message));
            });
            return;
          }

          if ('runId' in event && typeof event.runId === 'string' && event.runId.length > 0) {
            const active = this.activeAutomations.get(evaluationId);
            const activeRunId = active?.runId;
            if (activeRunId && event.runId !== activeRunId) {
              return;
            }
            if (active) {
              active.runId = event.runId;
            }
          }

          if (event.type === 'status') {
            if (event.status === 'running') {
              resumeClientTimeoutAfterChoice();
            }

            callbacks?.onStatus?.(event.status);
            return;
          }

          if (event.type === 'token_usage') {
            this.patchAutomationTokenUsage(evaluationId, event.usage);
            callbacks?.onProgress?.(event);
            return;
          }

          if (event.type === 'metadata_generated') {
            this.replaceEvaluation(event.evaluation);
            callbacks?.onProgress?.(event);
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
            pauseClientTimeoutForChoice();

            void (async () => {
              const runId =
                (typeof event.runId === 'string' && event.runId.length > 0
                  ? event.runId
                  : undefined) ?? this.activeAutomations.get(evaluationId)?.runId;

              const cancelProviderChoiceFlow = (message: string): void => {
                if (runId) {
                  void firstValueFrom(
                    this.http.post<{ cancelled: boolean }>(
                      `${API}/${evaluationId}/automate/cancel`,
                      { runId },
                    ),
                  ).catch(() => {
                    // already finished or never registered
                  });
                }

                finish(() => {
                  callbacks?.onStatus?.('cancelled');
                  if (callbacks?.operationFeedback) {
                    this.feedback.error(message);
                  }
                  reject(new Error(message));
                });
              };

              if (!runId) {
                cancelProviderChoiceFlow('Could not submit provider choice: missing run id.');
                return;
              }

              const promptAndSubmit = async (): Promise<'ok' | 'cancelled' | 'gone'> => {
                const useCloud = callbacks?.onSlowProviderPrompt
                  ? await this.ngZone.run(() => callbacks.onSlowProviderPrompt!(event))
                  : false;

                if (settled || runState.cancelledByUser) {
                  return 'cancelled';
                }

                try {
                  await postProviderChoice(runId, useCloud);
                  return 'ok';
                } catch (error) {
                  const status = (error as { status?: number })?.status;
                  const message = providerChoiceErrorMessage(error);
                  this.feedback.error(message);

                  // Pending choice gone — terminal.
                  if (status === 404) {
                    return 'gone';
                  }

                  throw Object.assign(new Error(message), { status, terminal: false });
                }
              };

              try {
                const result = await promptAndSubmit();

                // Soften transient/conflict failures: keep SSE open and allow one retry.
                if (result === 'ok' || result === 'cancelled') {
                  return;
                }

                if (result === 'gone') {
                  finish(() => {
                    callbacks?.onStatus?.('failed');
                    reject(
                      new Error(
                        'No provider choice is pending. It may have already been answered, timed out, or the server restarted.',
                      ),
                    );
                  });
                }
              } catch (firstError) {
                if (settled || runState.cancelledByUser) {
                  return;
                }

                if (!callbacks?.onSlowProviderPrompt) {
                  finish(() => {
                    callbacks?.onStatus?.('failed');
                    reject(
                      new Error(
                        firstError instanceof Error
                          ? firstError.message
                          : 'Could not submit provider choice.',
                      ),
                    );
                  });
                  return;
                }

                try {
                  const retry = await promptAndSubmit();

                  if (retry === 'gone') {
                    finish(() => {
                      callbacks?.onStatus?.('failed');
                      reject(
                        new Error(
                          'No provider choice is pending. It may have already been answered, timed out, or the server restarted.',
                        ),
                      );
                    });
                  }
                } catch (retryError) {
                  if (!settled && !runState.cancelledByUser) {
                    finish(() => {
                      callbacks?.onStatus?.('failed');
                      reject(
                        new Error(
                          retryError instanceof Error
                            ? retryError.message
                            : 'Could not submit provider choice.',
                        ),
                      );
                    });
                  }
                }
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
            // EventSource does not expose HTTP status; only hint when a token is relevant.
            const base =
              callbacks?.operationFeedback?.error ?? 'Automation connection failed.';
            const needsTokenHint =
              this.serverSettings.apiTokenRequired() || !!readStoredApiToken();
            const errorMessage = needsTokenHint
              ? `${base} Check your API token in Settings.`
              : base;
            if (callbacks?.operationFeedback) {
              this.feedback.error(errorMessage);
            }
            reject(new Error(errorMessage));
          });
        });
      };
    });
  }

  estimateRun(
    evaluation: Evaluation,
    phase: AutomationPhase = 'full',
  ): Promise<EvaluationRunEstimate> {
    return firstValueFrom(
      this.http.post<EvaluationRunEstimate>(`${API}/estimate`, {
        prompt: evaluation.prompt,
        criteriaMode: evaluation.criteriaMode,
        criteria: evaluation.criteria,
        answers: evaluation.answers,
        evaluationConfig: evaluation.evaluationConfig,
        phase,
      }),
    );
  }

  setWinner(
    evaluationId: string,
    answerId: string,
    reason: string,
    operationFeedback?: OperationFeedback,
  ): Evaluation | undefined {
    const evaluation = this.getById(evaluationId);

    if (!evaluation?.answers.some((answer) => answer.id === answerId)) {
      return undefined;
    }

    const priorWinnerId = evaluation.winnerAnswerId;
    const override: ManualOverrideRecord = {
      kind: 'winner',
      answerId,
      priorValue: priorWinnerId,
      newValue: answerId,
      reason,
      at: new Date().toISOString(),
    };

    return this.update(
      evaluationId,
      {
        winnerAnswerId: answerId,
        answers: evaluation.answers.map((answer) => ({
          ...answer,
          isWinner: answer.id === answerId,
        })),
        manualOverrides: [...(evaluation.manualOverrides ?? []), override],
      },
      operationFeedback,
    );
  }

  updateScoreWithOverride(
    evaluationId: string,
    answerId: string,
    criterion: RubricCriterion,
    points: number,
    reason: string,
  ): Evaluation | undefined {
    const evaluation = this.getById(evaluationId);
    const answer = evaluation?.answers.find((item) => item.id === answerId);

    if (!evaluation || !answer) {
      return undefined;
    }

    const priorScore = answer.scores.find((score) => score.criterionId === criterion.id);
    const override: ManualOverrideRecord = {
      kind: 'score',
      answerId,
      criterionId: criterion.id,
      priorValue: priorScore ? String(priorScore.points) : undefined,
      newValue: String(points),
      reason,
      at: new Date().toISOString(),
    };

    return this.update(
      evaluationId,
      {
        answers: evaluation.answers.map((item) =>
          item.id === answerId
            ? {
                ...item,
                scores: upsertCriterionScore(item.scores, criterion, points),
              }
            : item,
        ),
        manualOverrides: [...(evaluation.manualOverrides ?? []), override],
      },
      { success: 'Score updated.', error: 'Could not update score.' },
    );
  }

  updateJudgeStrictness(
    evaluationId: string,
    strictness: TaskDifficulty,
    operationFeedback?: OperationFeedback,
  ): Evaluation | undefined {
    const evaluation = this.getById(evaluationId);

    if (!evaluation) {
      return undefined;
    }

    return this.update(
      evaluationId,
      {
        evaluationConfig: {
          ...evaluation.evaluationConfig,
          judgeProfile: {
            ...evaluation.evaluationConfig.judgeProfile,
            strictness,
          },
        },
      },
      operationFeedback,
    );
  }

  /** Custom mode without criteria blocks automation; fall back to default rubric. */
  private resolveCreateCriteriaMode(dto: CreateEvaluationDto): CriteriaMode {
    const requested = dto.criteriaMode ?? this.settings.defaultCriteriaMode();
    const hasCriteria = (dto.criteria?.length ?? 0) > 0;

    return requested === 'custom' && !hasCriteria ? 'default' : requested;
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

  private enqueuePut(
    id: string,
    optimistic: Evaluation,
    baseUpdatedAt: string,
    rollbackTo: Evaluation,
    operationFeedback?: OperationFeedback,
  ): void {
    const runPut = (): Promise<void> =>
      new Promise<void>((resolve) => {
        this.putSubscriptions.get(id)?.unsubscribe();

        const live = this.getById(id);
        const concurrencyUpdatedAt =
          live && live !== optimistic ? live.updatedAt : baseUpdatedAt;

        const payload: Evaluation = {
          ...optimistic,
          // Send the known-good updatedAt so the server can reject stale writes.
          updatedAt: concurrencyUpdatedAt,
        };

        const subscription = this.http.put<Evaluation>(`${API}/${id}`, payload).subscribe({
          next: (saved) => {
            this.replaceEvaluation(saved);
            if (operationFeedback?.success) {
              this.feedback.success(operationFeedback.success);
            }
            resolve();
          },
          error: (error) => {
            // Only roll back if nothing else (SSE / later PUT) replaced our optimistic value.
            if (this.getById(id) === optimistic) {
              this.replaceEvaluation(rollbackTo);
            }
            if (operationFeedback) {
              this.feedback.error(messageFromHttpError(error, operationFeedback.error));
            }
            resolve();
          },
          complete: () => {
            if (this.putSubscriptions.get(id) === subscription) {
              this.putSubscriptions.delete(id);
            }
          },
        });

        this.putSubscriptions.set(id, subscription);
      });

    const track = (next: Promise<void>): void => {
      this.putChains.set(id, next);
      void next.finally(() => {
        if (this.putChains.get(id) === next) {
          this.putChains.delete(id);
        }
      });
    };

    // If nothing is in flight, start immediately (keeps HttpClientTesting sync-friendly).
    if (!this.putSubscriptions.has(id)) {
      track(runPut());
      return;
    }

    const previous = this.putChains.get(id) ?? Promise.resolve();
    track(previous.catch(() => undefined).then(() => runPut()));
  }

  /** Drop in-flight client PUTs so a completing automation is not overwritten by a stale write. */
  private cancelPendingPuts(id: string): void {
    const subscription = this.putSubscriptions.get(id);
    if (subscription) {
      subscription.unsubscribe();
      this.putSubscriptions.delete(id);
    }
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
