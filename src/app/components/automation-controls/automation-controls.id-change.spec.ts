import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_EVALUATION_CONFIG, Evaluation } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { SettingsService } from '../../services/settings.service';
import { AutomationControlsComponent } from './automation-controls';

describe('AutomationControlsComponent evaluationId change', () => {
  let component: AutomationControlsComponent;
  let fixture: ReturnType<typeof TestBed.createComponent<AutomationControlsComponent>>;
  let evaluationService: EvaluationService;

  const evalA: Evaluation = {
    id: 'eval-a',
    title: 'A',
    prompt: 'Prompt A long enough',
    criteriaMode: 'default',
    criteria: [],
    evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    answers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const evalB: Evaluation = {
    ...evalA,
    id: 'eval-b',
    title: 'B',
    prompt: 'Prompt B long enough',
  };

  beforeEach(() => {
    vi.stubGlobal('bootstrap', {
      Modal: {
        getOrCreateInstance: () => ({ show: vi.fn(), hide: vi.fn() }),
      },
    });

    TestBed.configureTestingModule({
      imports: [AutomationControlsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EvaluationService,
        FeedbackService,
        SettingsService,
      ],
    });

    evaluationService = TestBed.inject(EvaluationService);
    evaluationService['evaluationsSignal'].set([evalA, evalB]);

    fixture = TestBed.createComponent(AutomationControlsComponent);
    fixture.componentRef.setInput('evaluationId', 'eval-a');
    fixture.componentRef.setInput('phase', 'full');
    fixture.componentRef.setInput('buttonLabel', 'Run');
    fixture.componentRef.setInput('runningLabel', 'Running…');
    fixture.componentRef.setInput('statusHint', 'Hint');
    fixture.componentRef.setInput('successMessage', 'Done');
    fixture.componentRef.setInput('errorMessage', 'Failed');
    fixture.componentRef.setInput('confirmForceTitle', 'Replace?');
    fixture.componentRef.setInput('confirmForceMessage', 'Replace message');
    fixture.componentRef.setInput('autoStart', false);
    fixture.detectChanges();

    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('cancels the prior evaluation run when evaluationId changes', () => {
    const cancelSpy = vi.spyOn(evaluationService, 'cancelAutomation');

    component['automationOutcome'].set({ status: 'running' });
    component['progressSteps'].set(['Starting automation…']);
    component['autoStartTriggered'] = true;

    fixture.componentRef.setInput('evaluationId', 'eval-b');
    fixture.detectChanges();
    TestBed.tick();

    expect(cancelSpy).toHaveBeenCalledWith('eval-a');
    expect(component['automationOutcome']().status).toBe('idle');
    expect(component['progressSteps']()).toEqual([]);
    expect(component['autoStartTriggered']).toBe(false);
  });

  it('ignores late callbacks from a superseded evaluation id', async () => {
    let resolveA!: (evaluation: Evaluation) => void;
    let onStatusA: ((status: 'running' | 'completed' | 'failed' | 'cancelled') => void) | undefined;
    let onProgressA:
      | ((event: { type: 'generating'; modelLabel: string; index: number; total: number }) => void)
      | undefined;

    const automateSpy = vi
      .spyOn(evaluationService, 'automate')
      .mockImplementation((id, _opts, callbacks) => {
        if (id === 'eval-a') {
          onStatusA = callbacks?.onStatus;
          onProgressA = callbacks?.onProgress;
          return new Promise<Evaluation>((resolve) => {
            resolveA = resolve;
          });
        }

        return Promise.resolve(evalB);
      });

    const finished = vi.fn();
    component.automationFinished.subscribe(finished);

    const runA = component['runAutomate'](false);
    expect(automateSpy).toHaveBeenCalledWith('eval-a', expect.anything(), expect.anything());

    fixture.componentRef.setInput('evaluationId', 'eval-b');
    fixture.detectChanges();
    TestBed.tick();

    onProgressA?.({ type: 'generating', modelLabel: 'm1', index: 1, total: 3 });
    onStatusA?.('completed');
    resolveA(evalA);
    await runA;

    expect(component['progressSteps']()).toEqual([]);
    expect(component['automationOutcome']().status).toBe('idle');
    expect(finished).not.toHaveBeenCalled();
  });

  it('cancels the bound evaluation when destroyed while automating', () => {
    evaluationService.automatingEvaluationId.set('eval-a');
    const cancelSpy = vi.spyOn(evaluationService, 'cancelAutomation');

    fixture.destroy();

    expect(cancelSpy).toHaveBeenCalledWith('eval-a');
  });

  it('does not cancel on destroy when automation is already idle', () => {
    evaluationService.automatingEvaluationId.set(null);
    const cancelSpy = vi.spyOn(evaluationService, 'cancelAutomation');

    fixture.destroy();

    expect(cancelSpy).not.toHaveBeenCalled();
  });
});
