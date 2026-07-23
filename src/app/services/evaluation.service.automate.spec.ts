import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DEFAULT_EVALUATION_CONFIG, Evaluation } from '../models';
import { EvaluationService } from './evaluation.service';
import { FeedbackService } from './feedback.service';

describe('EvaluationService.automate', () => {
  let service: EvaluationService;
  let httpMock: HttpTestingController;

  const evaluation: Evaluation = {
    id: 'eval-1',
    title: 'Test',
    prompt: 'Say hello',
    criteriaMode: 'default',
    criteria: [],
    evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    answers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), EvaluationService, FeedbackService],
    });
    service = TestBed.inject(EvaluationService);
    httpMock = TestBed.inject(HttpTestingController);
    service['evaluationsSignal'].set([evaluation]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    httpMock.verify();
    localStorage.clear();
  });

  it('updates automationTokenUsage on token_usage SSE events', async () => {
    vi.useFakeTimers();

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: 'token_usage',
              usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
            }),
          } as MessageEvent);
        });
        setTimeout(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: 'complete',
              status: 'completed',
              evaluation: {
                ...evaluation,
                tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
              },
            }),
          } as MessageEvent);
        }, 20);
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const promise = service.automate('eval-1');
    await vi.advanceTimersByTimeAsync(0);

    expect(service.getAutomationTokenUsage('eval-1')).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });

    await vi.advanceTimersByTimeAsync(20);
    const result = await promise;

    expect(result.tokenUsage?.totalTokens).toBe(150);
    expect(service.getById('eval-1')?.tokenUsage?.totalTokens).toBe(150);
    expect(service.getAutomationTokenUsage('eval-1')).toBeNull();

    vi.useRealTimers();
  });

  it('tracks token usage per evaluation during concurrent automate runs', async () => {
    const evaluation2: Evaluation = {
      ...evaluation,
      id: 'eval-2',
      title: 'Test 2',
    };
    service['evaluationsSignal'].set([evaluation, evaluation2]);

    const instances: Array<{
      onmessage: ((event: MessageEvent) => void) | null;
      close: () => void;
    }> = [];

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        instances.push(this);
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const firstPromise = service.automate('eval-1');
    const secondPromise = service.automate('eval-2');
    await Promise.resolve();

    instances[0].onmessage!({
      data: JSON.stringify({
        type: 'token_usage',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        runId: 'run-1',
      }),
    } as MessageEvent);
    instances[1].onmessage!({
      data: JSON.stringify({
        type: 'token_usage',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        runId: 'run-2',
      }),
    } as MessageEvent);

    expect(service.getAutomationTokenUsage('eval-1')).toEqual({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
    expect(service.getAutomationTokenUsage('eval-2')).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });

    instances[0].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now-1' },
        runId: 'run-1',
      }),
    } as MessageEvent);
    instances[1].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation2, automatedAt: 'now-2' },
        runId: 'run-2',
      }),
    } as MessageEvent);

    await Promise.all([firstPromise, secondPromise]);
    expect(service.getAutomationTokenUsage('eval-1')).toBeNull();
    expect(service.getAutomationTokenUsage('eval-2')).toBeNull();
  });

  it('resolves when EventSource receives complete event', async () => {
    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: 'complete',
              status: 'completed',
              evaluation: { ...evaluation, automatedAt: 'now' },
            }),
          } as MessageEvent);
        });
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const result = await service.automate('eval-1');

    expect(result.automatedAt).toBe('now');
  });

  it('appends phase query param when phase is not full', async () => {
    let capturedUrl = '';

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        capturedUrl = url;
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: 'complete',
              status: 'completed',
              evaluation,
            }),
          } as MessageEvent);
        });
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    await service.automate('eval-1', { phase: 'generate' });

    expect(capturedUrl).toContain('phase=generate');
    expect(capturedUrl).not.toContain('force=true');
  });

  it('appends api_token query param when token is stored', async () => {
    localStorage.setItem('aieval-api-token', 'browser-secret');
    let capturedUrl = '';

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        capturedUrl = url;
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: 'complete',
              status: 'completed',
              evaluation,
            }),
          } as MessageEvent);
        });
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    await service.automate('eval-1');

    expect(capturedUrl).toContain('api_token=browser-secret');
  });

  it('sets automatingEvaluationId while EventSource is active and clears on complete', async () => {
    type MockSource = {
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: (() => void) | null;
      url: string;
      close: () => void;
    };

    let mockInstance: MockSource | null = null;

    class MockEventSource implements MockSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        mockInstance = this;
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    expect(service.automatingEvaluationId()).toBeNull();

    const automatePromise = service.automate('eval-1');

    expect(service.automatingEvaluationId()).toBe('eval-1');
    expect(service.isAutomating('eval-1')).toBe(true);
    expect(service.isAutomating('other')).toBe(false);

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    await automatePromise;

    expect(service.automatingEvaluationId()).toBeNull();
    expect(service.isAutomating()).toBe(false);
  });

  it('clears automatingEvaluationId when automation is cancelled', async () => {
    const runId = 'run-cancel-test';

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({ type: 'status', status: 'running', runId }),
          } as MessageEvent);
        });
      }

      close(): void {
        queueMicrotask(() => this.onerror?.());
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const automatePromise = service.automate('eval-1');

    expect(service.automatingEvaluationId()).toBe('eval-1');

    await Promise.resolve();

    service.cancelAutomation('eval-1');

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    expect(cancelReq.request.body).toEqual({ runId });
    cancelReq.flush({ cancelled: true });

    await expect(automatePromise).rejects.toThrow('Automation cancelled.');
    expect(service.automatingEvaluationId()).toBeNull();
  });

  it('clears automatingEvaluationId when EventSource receives error event', async () => {
    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: 'error',
              message: 'Provider failed',
              step: 'generating',
              status: 'failed',
            }),
          } as MessageEvent);
        });
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    await expect(service.automate('eval-1')).rejects.toThrow('Provider failed');
    expect(service.automatingEvaluationId()).toBeNull();
  });

  it('rejects EventSource onerror with an API token / Settings hint when a token is stored', async () => {
    localStorage.setItem('aieval-api-token', 'browser-secret');

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        queueMicrotask(() => this.onerror?.());
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    await expect(service.automate('eval-1')).rejects.toThrow(
      'Automation connection failed. Check your API token in Settings.',
    );
    expect(service.automatingEvaluationId()).toBeNull();
  });

  it('rejects EventSource onerror without an API token hint when none is configured', async () => {
    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        queueMicrotask(() => this.onerror?.());
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    await expect(service.automate('eval-1')).rejects.toThrow(
      /^Automation connection failed\.$/,
    );
  });

  it('closes prior EventSource and cancels server run when automate is called again', async () => {
    const runId = 'run-supersede-test';
    const instances: Array<{
      onmessage: ((event: MessageEvent) => void) | null;
      close: ReturnType<typeof vi.fn>;
    }> = [];

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn(() => {
        queueMicrotask(() => this.onerror?.());
      });

      constructor(public url: string) {
        instances.push(this);
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({ type: 'status', status: 'running', runId }),
          } as MessageEvent);
        });
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const firstPromise = service.automate('eval-1');
    expect(instances).toHaveLength(1);

    await Promise.resolve();

    const secondPromise = service.automate('eval-1');

    expect(instances[0].close).toHaveBeenCalled();

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    expect(cancelReq.request.body).toEqual({ runId });
    cancelReq.flush({ cancelled: true });

    await expect(firstPromise).rejects.toThrow('Automation cancelled.');

    instances[1].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    const result = await secondPromise;

    expect(result.automatedAt).toBe('now');
    expect(instances[1].close).toHaveBeenCalled();
  });

  it('posts provider choice with runId on slow_provider_prompt', async () => {
    type MockSource = {
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: (() => void) | null;
      url: string;
      close: () => void;
    };

    let mockInstance: MockSource | null = null;

    class MockEventSource implements MockSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        mockInstance = this;
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const automatePromise = service.automate('eval-1', {}, {
      onSlowProviderPrompt: async () => true,
    });

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'slow_provider_prompt',
        runId: 'run-slow-1',
        currentProvider: 'local',
        cloudProvider: 'groq',
        elapsedLabel: '2 minutes',
        choiceTimeoutLabel: '30 minutes',
      }),
    } as MessageEvent);

    await Promise.resolve();

    const choiceReq = httpMock.expectOne('/api/evaluations/eval-1/automate/provider-choice');
    expect(choiceReq.request.body).toEqual({ useCloud: true, runId: 'run-slow-1' });
    choiceReq.flush({ accepted: true });

    mockInstance!.onmessage!({
      data: JSON.stringify({ type: 'status', status: 'running', runId: 'run-slow-1' }),
    } as MessageEvent);

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    await automatePromise;
  });

  it('pauses client timeout while waiting for provider choice', async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    type MockSource = {
      onmessage: ((event: MessageEvent) => void) | null;
      close: () => void;
    };
    let mockInstance: MockSource | null = null;

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        mockInstance = this;
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const automatePromise = service.automate(
      'eval-1',
      {},
      {
        onSlowProviderPrompt: () =>
          new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), 15 * 60 * 1000);
          }),
      },
    );

    await vi.advanceTimersByTimeAsync(0);

    const timersBeforePrompt = setTimeoutSpy.mock.calls.length;
    clearTimeoutSpy.mockClear();

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'slow_provider_prompt',
        runId: 'run-pause-1',
        currentProvider: 'ollama',
        cloudProvider: 'groq',
        elapsedLabel: '2 minutes',
        choiceTimeoutLabel: '30 minutes',
      }),
    } as MessageEvent);

    await vi.advanceTimersByTimeAsync(0);
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Advancing past the original 10m budget must not time out while choice is pending.
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    httpMock.expectNone('/api/evaluations/eval-1/automate/cancel');

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    const choiceReq = httpMock.expectOne('/api/evaluations/eval-1/automate/provider-choice');
    choiceReq.flush({ accepted: true });

    mockInstance!.onmessage!({
      data: JSON.stringify({ type: 'status', status: 'running', runId: 'run-pause-1' }),
    } as MessageEvent);

    // Timeout should have been re-armed after choice resolves.
    expect(setTimeoutSpy.mock.calls.length).toBeGreaterThan(timersBeforePrompt);

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    await automatePromise;
    clearTimeoutSpy.mockRestore();
    setTimeoutSpy.mockRestore();
  });

  it('surfaces provider-choice HTTP status/body and retries once on non-404', async () => {
    type MockSource = {
      onmessage: ((event: MessageEvent) => void) | null;
      close: () => void;
    };
    let mockInstance: MockSource | null = null;
    let promptCalls = 0;

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        mockInstance = this;
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const feedback = TestBed.inject(FeedbackService);
    const errorSpy = vi.spyOn(feedback, 'error');

    const automatePromise = service.automate(
      'eval-1',
      {},
      {
        onSlowProviderPrompt: async () => {
          promptCalls += 1;
          return false;
        },
      },
    );

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'slow_provider_prompt',
        runId: 'run-retry-1',
        currentProvider: 'ollama',
        cloudProvider: null,
        elapsedLabel: '2 minutes',
        choiceTimeoutLabel: '30 minutes',
      }),
    } as MessageEvent);

    await Promise.resolve();

    const firstReq = httpMock.expectOne('/api/evaluations/eval-1/automate/provider-choice');
    firstReq.flush(
      { message: 'runId does not match the pending provider choice for this evaluation.' },
      { status: 409, statusText: 'Conflict' },
    );

    await vi.waitFor(() => {
      expect(promptCalls).toBe(2);
    });

    expect(errorSpy).toHaveBeenCalled();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('409');

    const retryReq = httpMock.expectOne('/api/evaluations/eval-1/automate/provider-choice');
    retryReq.flush({ accepted: true });

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    await automatePromise;
  });

  it('cancels and clears UI when slow_provider_prompt has no runId', async () => {
    type MockSource = {
      onmessage: ((event: MessageEvent) => void) | null;
      close: ReturnType<typeof vi.fn>;
    };
    let mockInstance: MockSource | null = null;

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();

      constructor(public url: string) {
        mockInstance = this;
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const statuses: string[] = [];
    const automatePromise = service.automate(
      'eval-1',
      {},
      {
        onStatus: (status) => statuses.push(status),
        onSlowProviderPrompt: async () => true,
        operationFeedback: { success: '', error: 'Automation failed.' },
      },
    );

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'slow_provider_prompt',
        currentProvider: 'ollama',
        cloudProvider: 'groq',
        elapsedLabel: '2 minutes',
        choiceTimeoutLabel: '30 minutes',
      }),
    } as MessageEvent);

    await expect(automatePromise).rejects.toThrow(
      'Could not submit provider choice: missing run id.',
    );
    expect(statuses).toContain('cancelled');
    expect(service.automatingEvaluationId()).toBeNull();
    httpMock.expectNone('/api/evaluations/eval-1/automate/provider-choice');
    httpMock.expectNone('/api/evaluations/eval-1/automate/cancel');
    expect(mockInstance!.close).toHaveBeenCalled();
  });

  it('uses active runId when slow_provider_prompt runId is empty', async () => {
    type MockSource = {
      onmessage: ((event: MessageEvent) => void) | null;
      close: ReturnType<typeof vi.fn>;
    };
    let mockInstance: MockSource | null = null;

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();

      constructor(public url: string) {
        mockInstance = this;
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    // Empty event.runId should fall back to active runId for choice — not cancel.
    const automatePromise = service.automate('eval-1', {}, {
      onSlowProviderPrompt: async () => true,
    });

    mockInstance!.onmessage!({
      data: JSON.stringify({ type: 'status', status: 'running', runId: 'run-active-1' }),
    } as MessageEvent);

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'slow_provider_prompt',
        runId: '',
        currentProvider: 'ollama',
        cloudProvider: 'groq',
        elapsedLabel: '2 minutes',
        choiceTimeoutLabel: '30 minutes',
      }),
    } as MessageEvent);

    await Promise.resolve();

    const choiceReq = httpMock.expectOne('/api/evaluations/eval-1/automate/provider-choice');
    expect(choiceReq.request.body).toEqual({ useCloud: true, runId: 'run-active-1' });
    choiceReq.flush({ accepted: true });

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    await automatePromise;
  });

  it('skips provider-choice POST when automation was cancelled during the prompt', async () => {
    type MockSource = {
      onmessage: ((event: MessageEvent) => void) | null;
      close: ReturnType<typeof vi.fn>;
    };
    let mockInstance: MockSource | null = null;
    let resolvePrompt!: (value: boolean) => void;

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();

      constructor(public url: string) {
        mockInstance = this;
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const automatePromise = service.automate(
      'eval-1',
      {},
      {
        onSlowProviderPrompt: () =>
          new Promise<boolean>((resolve) => {
            resolvePrompt = resolve;
          }),
      },
    );

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'status',
        status: 'running',
        runId: 'run-cancel-prompt',
      }),
    } as MessageEvent);

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'slow_provider_prompt',
        runId: 'run-cancel-prompt',
        currentProvider: 'ollama',
        cloudProvider: 'groq',
        elapsedLabel: '2 minutes',
        choiceTimeoutLabel: '30 minutes',
      }),
    } as MessageEvent);

    await Promise.resolve();
    expect(typeof resolvePrompt).toBe('function');

    service.cancelAutomation('eval-1');

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    cancelReq.flush({ cancelled: true });

    await expect(automatePromise).rejects.toThrow('Automation cancelled.');

    resolvePrompt(false);
    await Promise.resolve();
    await Promise.resolve();

    httpMock.expectNone('/api/evaluations/eval-1/automate/provider-choice');
  });

  it('clears client timeout when complete event is received', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({
              type: 'complete',
              status: 'completed',
              evaluation: { ...evaluation, automatedAt: 'now' },
            }),
          } as MessageEvent);
        });
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    await service.automate('eval-1');

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('clears prior client timeout when automate is superseded', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const runId = 'run-supersede-timeout';
    const instances: Array<{
      onmessage: ((event: MessageEvent) => void) | null;
      close: ReturnType<typeof vi.fn>;
    }> = [];

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn(() => {
        queueMicrotask(() => this.onerror?.());
      });

      constructor(public url: string) {
        instances.push(this);
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({ type: 'status', status: 'running', runId }),
          } as MessageEvent);
        });
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const firstPromise = service.automate('eval-1');
    await Promise.resolve();

    clearTimeoutSpy.mockClear();

    const secondPromise = service.automate('eval-1');

    expect(clearTimeoutSpy).toHaveBeenCalled();

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    cancelReq.flush({ cancelled: true });

    await expect(firstPromise).rejects.toThrow('Automation cancelled.');

    instances[1].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    await secondPromise;
    clearTimeoutSpy.mockRestore();
  });

  it('POSTs cancel when client automate timeout fires', async () => {
    vi.useFakeTimers();
    const runId = 'run-client-timeout';

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn();

      constructor(public url: string) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({ type: 'status', status: 'running', runId }),
          } as MessageEvent);
        });
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const automatePromise = service.automate('eval-1');
    await vi.advanceTimersByTimeAsync(0);

    const timeoutPromise = expect(automatePromise).rejects.toThrow(
      'Automation timed out after 10 minutes.',
    );

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    expect(cancelReq.request.body).toEqual({ runId });
    cancelReq.flush({ cancelled: true });

    await timeoutPromise;
    expect(service.automatingEvaluationId()).toBeNull();
  });

  it('invokes onStatus for status, complete, error, and cancel events', async () => {
    const statuses: string[] = [];

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({ type: 'status', status: 'running' }),
          } as MessageEvent);
          this.onmessage?.({
            data: JSON.stringify({
              type: 'error',
              message: 'Automation cancelled.',
              step: 'generating',
              status: 'cancelled',
            }),
          } as MessageEvent);
        });
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    await expect(
      service.automate('eval-1', {}, { onStatus: (status) => statuses.push(status) }),
    ).rejects.toThrow('Automation cancelled.');

    expect(statuses).toEqual(['running', 'cancelled']);
  });

  it('rejects automate() when cancelled and EventSource.close() does not fire onerror', async () => {
    const runId = 'run-cancel-noop-close';

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({ type: 'status', status: 'running', runId }),
          } as MessageEvent);
        });
      }

      close(): void {
        // Real browsers often do not invoke onerror after close().
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const automatePromise = service.automate('eval-1');
    await Promise.resolve();

    service.cancelAutomation('eval-1');

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    cancelReq.flush({ cancelled: true });

    await expect(automatePromise).rejects.toThrow('Automation cancelled.');
    expect(service.automatingEvaluationId()).toBeNull();
  });

  it('rejects prior automate() on same eval when superseded and close() is a no-op', async () => {
    const runId = 'run-supersede-noop-close';
    const instances: MockEventSource[] = [];

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        instances.push(this);
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({ type: 'status', status: 'running', runId }),
          } as MessageEvent);
        });
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const firstPromise = service.automate('eval-1');
    await Promise.resolve();

    const secondPromise = service.automate('eval-1');

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    cancelReq.flush({ cancelled: true });

    await expect(firstPromise).rejects.toThrow('Automation cancelled.');

    instances[1].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    const result = await secondPromise;
    expect(result.automatedAt).toBe('now');
  });

  it('fails automation when an SSE payload is not valid JSON', async () => {
    type MockSource = {
      onmessage: ((event: MessageEvent) => void) | null;
      close: () => void;
    };
    let mockInstance: MockSource | null = null;

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        mockInstance = this;
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const feedback = TestBed.inject(FeedbackService);
    const errorSpy = vi.spyOn(feedback, 'error');
    const statuses: string[] = [];

    const automatePromise = service.automate(
      'eval-1',
      {},
      {
        onStatus: (status) => statuses.push(status),
        operationFeedback: {
          success: 'ok',
          error: 'Automation failed.',
        },
      },
    );

    mockInstance!.onmessage!({ data: '{not-json' } as MessageEvent);

    await expect(automatePromise).rejects.toThrow(
      'Automation received an invalid progress event.',
    );
    expect(statuses).toEqual(['failed']);
    expect(errorSpy).toHaveBeenCalledWith('Automation received an invalid progress event.');
    expect(service.automatingEvaluationId()).toBeNull();
  });

  it('ignores late onmessage from a disposed EventSource so it cannot poison runId', async () => {
    const instances: Array<{
      onmessage: ((event: MessageEvent) => void) | null;
      close: () => void;
    }> = [];

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        instances.push(this);
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const firstPromise = service.automate('eval-1');
    instances[0].onmessage!({
      data: JSON.stringify({ type: 'status', status: 'running', runId: 'run-old' }),
    } as MessageEvent);
    expect(service['activeAutomations'].get('eval-1')?.runId).toBe('run-old');

    const secondPromise = service.automate('eval-1');
    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    cancelReq.flush({ cancelled: true });
    await expect(firstPromise).rejects.toThrow('Automation cancelled.');

    expect(service['activeAutomations'].get('eval-1')?.eventSource).toBe(instances[1]);
    expect(service['activeAutomations'].get('eval-1')?.runId).toBeUndefined();

    // Late message from the disposed EventSource must not write onto the active run.
    instances[0].onmessage!({
      data: JSON.stringify({ type: 'status', status: 'running', runId: 'run-poison' }),
    } as MessageEvent);
    expect(service['activeAutomations'].get('eval-1')?.runId).toBeUndefined();

    instances[0].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'stale' },
        runId: 'run-poison',
      }),
    } as MessageEvent);
    expect(service.getById('eval-1')?.automatedAt).toBeUndefined();

    instances[1].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
        runId: 'run-new',
      }),
    } as MessageEvent);

    const result = await secondPromise;
    expect(result.automatedAt).toBe('now');
    expect(service['activeAutomations'].get('eval-1')).toBeUndefined();
  });

  it('ignores SSE events whose runId does not match the active run', async () => {
    type MockSource = {
      onmessage: ((event: MessageEvent) => void) | null;
      close: () => void;
    };
    let mockInstance: MockSource | null = null;

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        mockInstance = this;
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const progressTypes: string[] = [];
    const automatePromise = service.automate(
      'eval-1',
      {},
      {
        onProgress: (event) => progressTypes.push(event.type),
      },
    );

    mockInstance!.onmessage!({
      data: JSON.stringify({ type: 'status', status: 'running', runId: 'run-active' }),
    } as MessageEvent);

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'answer_generated',
        answerId: 'a-stale',
        label: 'Stale',
        runId: 'run-stale',
      }),
    } as MessageEvent);

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'error',
        message: 'Stale run failed',
        step: 'generating',
        status: 'failed',
        runId: 'run-stale',
      }),
    } as MessageEvent);

    mockInstance!.onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now' },
        runId: 'run-active',
      }),
    } as MessageEvent);

    const result = await automatePromise;

    expect(progressTypes).toEqual(['complete']);
    expect(result.automatedAt).toBe('now');
    expect(service.automatingEvaluationId()).toBeNull();
  });

  it('allows concurrent automate() for different evaluations', async () => {
    const evaluation2: Evaluation = {
      ...evaluation,
      id: 'eval-2',
      title: 'Test 2',
    };
    service['evaluationsSignal'].set([evaluation, evaluation2]);

    const runId1 = 'run-eval-1';
    const runId2 = 'run-eval-2';
    const instances: MockEventSource[] = [];

    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        instances.push(this);
        const runId = url.includes('eval-2') ? runId2 : runId1;
        queueMicrotask(() => {
          this.onmessage?.({
            data: JSON.stringify({ type: 'status', status: 'running', runId }),
          } as MessageEvent);
        });
      }

      close(): void {
        // noop
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const firstPromise = service.automate('eval-1');
    await Promise.resolve();
    expect(service.isAutomating('eval-1')).toBe(true);

    const secondPromise = service.automate('eval-2');
    await Promise.resolve();
    expect(service.isAutomating('eval-1')).toBe(true);
    expect(service.isAutomating('eval-2')).toBe(true);
    expect(service.isAutomating()).toBe(true);

    httpMock.expectNone('/api/evaluations/eval-1/automate/cancel');

    instances[0].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation, automatedAt: 'now-1' },
        runId: runId1,
      }),
    } as MessageEvent);

    instances[1].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation2, automatedAt: 'now-2' },
        runId: runId2,
      }),
    } as MessageEvent);

    const [result1, result2] = await Promise.all([firstPromise, secondPromise]);
    expect(result1.automatedAt).toBe('now-1');
    expect(result2.automatedAt).toBe('now-2');
    expect(service.isAutomating()).toBe(false);
  });
});
