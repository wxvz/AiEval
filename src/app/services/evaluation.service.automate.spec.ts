import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { Evaluation } from '../models';
import { EvaluationService } from './evaluation.service';
import { FeedbackService } from './feedback.service';

describe('EvaluationService.automate', () => {
  let service: EvaluationService;

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
      providers: [provideHttpClient(), EvaluationService, FeedbackService],
    });
    service = TestBed.inject(EvaluationService);
    service['evaluationsSignal'].set([evaluation]);
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
    vi.unstubAllGlobals();
  });
});
