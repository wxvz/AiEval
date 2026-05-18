import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Evaluation } from '../models';
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
    vi.unstubAllGlobals();
    httpMock.verify();
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
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    await automatePromise;

    expect(service.automatingEvaluationId()).toBeNull();
    expect(service.isAutomating()).toBe(false);
  });

  it('clears automatingEvaluationId when automation is cancelled', async () => {
    class MockEventSource {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(public url: string) {
        // keep connection open until cancelled
      }

      close(): void {
        queueMicrotask(() => this.onerror?.());
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const automatePromise = service.automate('eval-1');

    expect(service.automatingEvaluationId()).toBe('eval-1');

    service.cancelAutomation('eval-1');

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
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
            data: JSON.stringify({ type: 'error', message: 'Provider failed' }),
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
      }
    }

    vi.stubGlobal('EventSource', MockEventSource);

    const firstPromise = service.automate('eval-1');
    expect(instances).toHaveLength(1);

    const secondPromise = service.automate('eval-1');

    expect(instances[0].close).toHaveBeenCalled();

    const cancelReq = httpMock.expectOne('/api/evaluations/eval-1/automate/cancel');
    cancelReq.flush({ cancelled: true });

    await expect(firstPromise).rejects.toThrow('Automation cancelled.');

    instances[1].onmessage!({
      data: JSON.stringify({
        type: 'complete',
        evaluation: { ...evaluation, automatedAt: 'now' },
      }),
    } as MessageEvent);

    const result = await secondPromise;

    expect(result.automatedAt).toBe('now');
    expect(instances[1].close).toHaveBeenCalled();
  });
});
