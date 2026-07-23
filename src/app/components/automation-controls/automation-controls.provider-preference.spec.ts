import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_EVALUATION_CONFIG, Evaluation } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { SettingsService } from '../../services/settings.service';
import { AutomationControlsComponent } from './automation-controls';

describe('AutomationControlsComponent provider preference', () => {
  let settingsService: SettingsService;
  let evaluationService: EvaluationService;
  let component: AutomationControlsComponent;

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

  const slowPromptEvent = {
    type: 'slow_provider_prompt' as const,
    runId: 'run-1',
    currentProvider: 'ollama',
    cloudProvider: 'groq',
    elapsedLabel: '3 minutes',
    choiceTimeoutLabel: '30 minutes',
  };

  beforeEach(() => {
    localStorage.clear();
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

    settingsService = TestBed.inject(SettingsService);
    evaluationService = TestBed.inject(EvaluationService);
    evaluationService['evaluationsSignal'].set([evaluation]);

    const fixture = TestBed.createComponent(AutomationControlsComponent);
    fixture.componentRef.setInput('evaluationId', 'eval-1');
    fixture.componentRef.setInput('phase', 'full');
    fixture.componentRef.setInput('buttonLabel', 'Run');
    fixture.componentRef.setInput('runningLabel', 'Running…');
    fixture.componentRef.setInput('statusHint', 'Hint');
    fixture.componentRef.setInput('successMessage', 'Done');
    fixture.componentRef.setInput('errorMessage', 'Failed');
    fixture.componentRef.setInput('confirmForceTitle', 'Replace?');
    fixture.componentRef.setInput('confirmForceMessage', 'Replace message');
    fixture.detectChanges();

    component = fixture.componentInstance;
  });

  function promptProviderChoice(preference: 'ask' | 'local' | 'cloud') {
    settingsService.setAutomationProviderPreference(preference);
    return (
      component as unknown as {
        promptProviderChoice: (e: typeof slowPromptEvent) => Promise<boolean>;
      }
    ).promptProviderChoice(slowPromptEvent);
  }

  it('prefers local without opening the modal', async () => {
    await expect(promptProviderChoice('local')).resolves.toBe(false);
  });

  it('prefers cloud when a cloud provider is available', async () => {
    await expect(promptProviderChoice('cloud')).resolves.toBe(true);
  });

  it('cancels automation when preference is ask but modal element is missing', async () => {
    settingsService.setAutomationProviderPreference('ask');
    const cancelSpy = vi.spyOn(evaluationService, 'cancelAutomation');
    vi.spyOn(document, 'getElementById').mockReturnValue(null);

    await expect(promptProviderChoice('ask')).resolves.toBe(false);

    expect(cancelSpy).toHaveBeenCalledWith('eval-1');
  });
});
