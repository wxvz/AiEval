import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DEFAULT_EVALUATION_CONFIG } from '../models';
import { EvaluationService } from '../services/evaluation.service';
import { useAutomationPageContext } from './automation-page-context';

describe('useAutomationPageContext', () => {
  let evaluationService: EvaluationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EvaluationService],
    });

    evaluationService = TestBed.inject(EvaluationService);
  });

  it('automating is false when evaluation id is null', () => {
    const id = signal<string | null>(null);

    TestBed.runInInjectionContext(() => {
      const { automating } = useAutomationPageContext(() => id());

      expect(automating()).toBe(false);
    });
  });

  it('automating is true when service marks that evaluation', () => {
    const id = signal<string | null>('eval-1');
    evaluationService.automatingEvaluationId.set('eval-1');

    TestBed.runInInjectionContext(() => {
      const { automating } = useAutomationPageContext(() => id());

      expect(automating()).toBe(true);
    });
  });

  it('displayTokenUsage returns evaluation usage when idle', () => {
    const usage = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };
    const evaluation = {
      id: 'eval-usage',
      title: 'T',
      prompt: 'P',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      tokenUsage: usage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].set([evaluation]);

    TestBed.runInInjectionContext(() => {
      const { displayTokenUsage } = useAutomationPageContext(() => 'eval-usage');

      expect(displayTokenUsage()).toEqual(usage);
    });
  });

  it('displayTokenUsage prefers live automation usage while running', () => {
    const stored = { promptTokens: 1, completionTokens: 2, totalTokens: 3 };
    const live = { promptTokens: 100, completionTokens: 200, totalTokens: 300 };
    const evaluation = {
      id: 'eval-live',
      title: 'T',
      prompt: 'P',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      tokenUsage: stored,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].set([evaluation]);
    evaluationService.automatingEvaluationId.set('eval-live');
    evaluationService.setAutomationTokenUsageForTests('eval-live', live);

    TestBed.runInInjectionContext(() => {
      const { displayTokenUsage } = useAutomationPageContext(() => 'eval-live');

      expect(displayTokenUsage()).toEqual(live);
    });
  });
});
