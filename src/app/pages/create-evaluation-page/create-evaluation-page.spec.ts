import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AUTOMATION_METADATA_STUB } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { CreateEvaluationPage } from './create-evaluation-page';

describe('CreateEvaluationPage', () => {
  let page: CreateEvaluationPage;
  let fixture: import('@angular/core/testing').ComponentFixture<CreateEvaluationPage>;
  let evaluationService: EvaluationService;
  let routerNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    routerNavigate = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      imports: [CreateEvaluationPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EvaluationService,
        FeedbackService,
        { provide: Router, useValue: { navigate: routerNavigate } },
      ],
    });

    evaluationService = TestBed.inject(EvaluationService);
    fixture = TestBed.createComponent(CreateEvaluationPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('onRunFullAutomation creates stub evaluation when form is empty', async () => {
    const created = {
      id: 'eval-new',
      title: AUTOMATION_METADATA_STUB,
      prompt: AUTOMATION_METADATA_STUB,
      criteriaMode: 'default' as const,
      criteria: [],
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createSpy = vi.spyOn(evaluationService, 'create').mockResolvedValue(created);

    await page['onRunFullAutomation']();

    expect(createSpy).toHaveBeenCalledWith(
      {
        title: AUTOMATION_METADATA_STUB,
        prompt: AUTOMATION_METADATA_STUB,
      },
      {
        success: 'Evaluation created.',
        error: 'Could not create evaluation.',
      },
    );
    expect(page['createdEvaluationId']()).toBe('eval-new');
    expect(routerNavigate).not.toHaveBeenCalled();
  });

  it('onRunFullAutomation uses form title and prompt when both are filled', async () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    form!.form.controls.title.setValue('My evaluation');
    form!.form.controls.prompt.setValue('A detailed prompt for comparing model answers.');

    const created = {
      id: 'eval-user',
      title: 'My evaluation',
      prompt: 'A detailed prompt for comparing model answers.',
      criteriaMode: 'default' as const,
      criteria: [],
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createSpy = vi.spyOn(evaluationService, 'create').mockResolvedValue(created);

    await page['onRunFullAutomation']();

    expect(createSpy).toHaveBeenCalledWith(
      {
        title: 'My evaluation',
        prompt: 'A detailed prompt for comparing model answers.',
      },
      {
        success: 'Evaluation created.',
        error: 'Could not create evaluation.',
      },
    );
    expect(page['createdEvaluationId']()).toBe('eval-user');
  });

  it('onRunFullAutomation does nothing when only title is filled', async () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    form!.form.controls.title.setValue('Title only');
    fixture.detectChanges();

    const createSpy = vi.spyOn(evaluationService, 'create');

    await page['onRunFullAutomation']();

    expect(createSpy).not.toHaveBeenCalled();
    expect(page['createdEvaluationId']()).toBeNull();
  });

  it('onGeneratePrompt chains generateTitle and generatePrompt when title is empty', async () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    const generateTitleSpy = vi
      .spyOn(evaluationService, 'generateTitle')
      .mockResolvedValue('Generated title');
    const generatePromptSpy = vi
      .spyOn(evaluationService, 'generatePrompt')
      .mockResolvedValue('Generated prompt text for evaluation.');

    await page['onGeneratePrompt']();

    expect(generateTitleSpy).toHaveBeenCalled();
    expect(generatePromptSpy).toHaveBeenCalledWith('Generated title', {
      success: 'Prompt generated.',
      error: 'Could not generate prompt.',
    });
    expect(form!.getValue().title).toBe('Generated title');
    expect(form!.getValue().prompt).toBe('Generated prompt text for evaluation.');
  });

  it('onGeneratePrompt calls generateTitle when title is whitespace-only', async () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    form!.form.controls.title.setValue('   ');

    const generateTitleSpy = vi
      .spyOn(evaluationService, 'generateTitle')
      .mockResolvedValue('Generated title');
    const generatePromptSpy = vi
      .spyOn(evaluationService, 'generatePrompt')
      .mockResolvedValue('Generated prompt text for evaluation.');

    await page['onGeneratePrompt']();

    expect(generateTitleSpy).toHaveBeenCalled();
    expect(generatePromptSpy).toHaveBeenCalledWith('Generated title', {
      success: 'Prompt generated.',
      error: 'Could not generate prompt.',
    });
  });

  it('automationBlocksActions is false after automation completes', () => {
    const evaluation = {
      id: 'eval-done',
      title: 'Generated title',
      prompt: 'Generated prompt for the evaluation run.',
      criteriaMode: 'default' as const,
      criteria: [],
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].update((list) => [...list, evaluation]);
    page['createdEvaluationId'].set('eval-done');

    expect(page['automationBlocksActions']()).toBe(false);
  });

  it('automationBlocksActions is true while automation is in progress', () => {
    evaluationService.automatingEvaluationId.set('eval-1');
    page['createdEvaluationId'].set('eval-1');

    expect(page['automationBlocksActions']()).toBe(true);
  });

  it('showFullAutomationRerun is true when automation completed', () => {
    const evaluation = {
      id: 'eval-done',
      title: 'Done',
      prompt: 'Done prompt for evaluation.',
      criteriaMode: 'default' as const,
      criteria: [],
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].update((list) => [...list, evaluation]);
    page['createdEvaluationId'].set('eval-done');

    expect(page['showFullAutomationRerun']()).toBe(true);
    expect(page['canRunFullAutomation']()).toBe(false);
  });

  it('onAutomationFinished syncs title and prompt into the form', () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    page['onAutomationFinished']({
      id: 'eval-sync',
      title: 'Synced title',
      prompt: 'Synced prompt text for the evaluation.',
      criteriaMode: 'default',
      criteria: [],
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(form!.getValue().title).toBe('Synced title');
    expect(form!.getValue().prompt).toBe('Synced prompt text for the evaluation.');
  });

  it('onAutomationStatusDismissed syncs evaluation into the form', () => {
    const evaluation = {
      id: 'eval-dismiss',
      title: 'Dismiss title',
      prompt: 'Dismiss prompt text for the evaluation.',
      criteriaMode: 'default' as const,
      criteria: [],
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].update((list) => [...list, evaluation]);
    page['createdEvaluationId'].set('eval-dismiss');

    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    page['onAutomationStatusDismissed']();

    expect(form!.getValue().title).toBe('Dismiss title');
    expect(form!.getValue().prompt).toBe('Dismiss prompt text for the evaluation.');
  });

  it('onGeneratePrompt uses existing title when valid', async () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    form!.form.controls.title.setValue('My existing title');

    const generateTitleSpy = vi.spyOn(evaluationService, 'generateTitle');
    const generatePromptSpy = vi
      .spyOn(evaluationService, 'generatePrompt')
      .mockResolvedValue('Generated prompt from existing title.');

    await page['onGeneratePrompt']();

    expect(generateTitleSpy).not.toHaveBeenCalled();
    expect(generatePromptSpy).toHaveBeenCalledWith('My existing title', {
      success: 'Prompt generated.',
      error: 'Could not generate prompt.',
    });
  });
});
