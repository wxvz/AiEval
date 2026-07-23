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

    expect(service.automationTokenUsage()).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });

    await vi.advanceTimersByTimeAsync(20);
    const result = await promise;

    expect(result.tokenUsage?.totalTokens).toBe(150);
    expect(service.getById('eval-1')?.tokenUsage?.totalTokens).toBe(150);
    expect(service.automationTokenUsage()).toBeNull();

    vi.useRealTimers();
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
      }),
    } as MessageEvent);

    await Promise.resolve();

    const choiceReq = httpMock.expectOne('/api/evaluations/eval-1/automate/provider-choice');
    expect(choiceReq.request.body).toEqual({ useCloud: true, runId: 'run-slow-1' });
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

  it('rejects prior automate() on different eval when superseded and close() is a no-op', async () => {
    const evaluation2: Evaluation = {
      ...evaluation,
      id: 'eval-2',
      title: 'Test 2',
    };
    service['evaluationsSignal'].set([evaluation, evaluation2]);

    const runId = 'run-cross-eval';
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
    expect(service.automatingEvaluationId()).toBe('eval-1');

    const secondPromise = service.automate('eval-2');
    expect(service.automatingEvaluationId()).toBe('eval-2');

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    cancelReq.flush({ cancelled: true });

    await expect(firstPromise).rejects.toThrow('Automation cancelled.');

    instances[1].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        status: 'completed',
        evaluation: { ...evaluation2, automatedAt: 'now' },
      }),
    } as MessageEvent);

    const result = await secondPromise;
    expect(result.automatedAt).toBe('now');
    expect(result.id).toBe('eval-2');
  });
});
