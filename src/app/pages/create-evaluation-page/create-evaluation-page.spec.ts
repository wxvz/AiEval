import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';

import {
  AUTOMATION_METADATA_STUB_PROMPT,
  AUTOMATION_METADATA_STUB_TITLE,
} from '../../../../server/src/automation/constants';
import { LearnHandoffService } from '../../learn/learn-handoff.service';
import { DEFAULT_EVALUATION_CONFIG, Evaluation } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { TemplateService } from '../../services/template.service';
import { CreateEvaluationPage } from './create-evaluation-page';

describe('CreateEvaluationPage', () => {
  let page: CreateEvaluationPage;
  let fixture: import('@angular/core/testing').ComponentFixture<CreateEvaluationPage>;
  let evaluationService: EvaluationService;
  let learnHandoff: LearnHandoffService;
  let routerNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    routerNavigate = vi.fn().mockResolvedValue(true);

    TestBed.configureTestingModule({
      imports: [CreateEvaluationPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EvaluationService,
        FeedbackService,
        TemplateService,
        { provide: Router, useValue: { navigate: routerNavigate } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
      ],
    });

    evaluationService = TestBed.inject(EvaluationService);
    learnHandoff = TestBed.inject(LearnHandoffService);
    fixture = TestBed.createComponent(CreateEvaluationPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('onRunFullAutomation creates stub evaluation when form is empty', async () => {
    const created = {
      id: 'eval-new',
      title: AUTOMATION_METADATA_STUB_TITLE,
      prompt: AUTOMATION_METADATA_STUB_PROMPT,
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createSpy = vi.spyOn(evaluationService, 'create').mockResolvedValue(created);

    await page['onRunFullAutomation']();

    expect(createSpy).toHaveBeenCalledWith(
      {
        title: AUTOMATION_METADATA_STUB_TITLE,
        prompt: AUTOMATION_METADATA_STUB_PROMPT,
        evaluationConfig: DEFAULT_EVALUATION_CONFIG,
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
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
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
        evaluationConfig: DEFAULT_EVALUATION_CONFIG,
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

    expect(generateTitleSpy).toHaveBeenCalledWith(
      DEFAULT_EVALUATION_CONFIG,
      {
        success: '',
        error: 'Could not generate title.',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(generatePromptSpy).toHaveBeenCalledWith(
      'Generated title',
      DEFAULT_EVALUATION_CONFIG,
      {
        success: 'Prompt generated.',
        error: 'Could not generate prompt.',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(form!.getValue().title).toBe('Generated title');
    expect(form!.getValue().prompt).toBe('Generated prompt text for evaluation.');
  });

  it('onGeneratePrompt does not set title when prompt generation fails after title', async () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    vi.spyOn(evaluationService, 'generateTitle').mockResolvedValue('Generated title');
    vi.spyOn(evaluationService, 'generatePrompt').mockRejectedValue(new Error('prompt failed'));

    await page['onGeneratePrompt']();

    expect(form!.getValue().title).toBe('');
    expect(form!.getValue().prompt).toBe('');
  });

  it('onGeneratePrompt does not mutate form when generated values are under min length', async () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    vi.spyOn(evaluationService, 'generateTitle').mockResolvedValue('ab');
    vi.spyOn(evaluationService, 'generatePrompt').mockResolvedValue('short');

    await page['onGeneratePrompt']();

    expect(form!.getValue().title).toBe('');
    expect(form!.getValue().prompt).toBe('');
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
    expect(generatePromptSpy).toHaveBeenCalledWith(
      'Generated title',
      DEFAULT_EVALUATION_CONFIG,
      {
        success: 'Prompt generated.',
        error: 'Could not generate prompt.',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('canDeactivate aborts an in-flight generate-prompt request', () => {
    page['generatingPrompt'].set(true);
    const abort = new AbortController();
    page['generatePromptAbort'] = abort;

    expect(page.canDeactivate()).toBe(true);
    expect(abort.signal.aborted).toBe(true);
    expect(page['generatingPrompt']()).toBe(false);
  });

  it('sets returnValue on beforeunload while generatingPrompt', () => {
    page['generatingPrompt'].set(true);
    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefault = vi.spyOn(event, 'preventDefault');

    page.onBeforeUnload(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBeTruthy();
  });

  it('automationBlocksActions is false after automation completes', () => {
    const evaluation = {
      id: 'eval-done',
      title: 'Generated title',
      prompt: 'Generated prompt for the evaluation run.',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
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
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
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
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(form!.getValue().title).toBe('Synced title');
    expect(form!.getValue().prompt).toBe('Synced prompt text for the evaluation.');
  });

  it('syncs title and prompt into the form when metadata arrives during automation', () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    evaluationService.automatingEvaluationId.set('eval-live');
    page['createdEvaluationId'].set('eval-live');
    evaluationService['evaluationsSignal'].update((list) => [
      ...list,
      {
        id: 'eval-live',
        title: AUTOMATION_METADATA_STUB_TITLE,
        prompt: AUTOMATION_METADATA_STUB_PROMPT,
        criteriaMode: 'default',
        criteria: [],
        evaluationConfig: DEFAULT_EVALUATION_CONFIG,
        answers: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    evaluationService['evaluationsSignal'].update((list) =>
      list.map((item) =>
        item.id === 'eval-live'
          ? {
              ...item,
              title: 'Live title',
              prompt: 'Live prompt text for the evaluation.',
            }
          : item,
      ),
    );

    fixture.detectChanges();

    expect(form!.getValue().title).toBe('Live title');
    expect(form!.getValue().prompt).toBe('Live prompt text for the evaluation.');
  });

  it('showActiveAutomationControls is false when automation complete and eval is listed', () => {
    const evaluation = {
      id: 'eval-complete',
      title: 'Complete title',
      prompt: 'Complete prompt.',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].update((list) => [...list, evaluation]);
    page['createdEvaluationId'].set('eval-complete');
    page['completedEvaluationIds'].set(['eval-complete']);

    expect(page['showActiveAutomationControls']()).toBe(false);
  });

  it('showActiveAutomationControls is true while automation is running', () => {
    evaluationService.automatingEvaluationId.set('eval-run');
    page['createdEvaluationId'].set('eval-run');

    expect(page['showActiveAutomationControls']()).toBe(true);
  });

  it('onAutomationFinished adds evaluation id to completedEvaluationIds', () => {
    const evaluation = {
      id: 'eval-complete',
      title: 'Complete title',
      prompt: 'Complete prompt.',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].update((list) => [...list, evaluation]);
    page['createdEvaluationId'].set('eval-complete');

    page['onAutomationFinished'](evaluation);

    expect(page['completedEvaluationIds']()).toEqual(['eval-complete']);
  });

  it('onRunNewFullAutomation remembers prior eval and switches to new id', async () => {
    const prior = {
      id: 'eval-a',
      title: 'Evaluation A',
      prompt: 'Prompt A.',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = {
      id: 'eval-b',
      title: AUTOMATION_METADATA_STUB_TITLE,
      prompt: AUTOMATION_METADATA_STUB_PROMPT,
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].update((list) => [...list, prior]);
    page['createdEvaluationId'].set('eval-a');
    page['completedEvaluationIds'].set(['eval-a']);

    const createSpy = vi.spyOn(evaluationService, 'create').mockResolvedValue(created);

    await page['onRunNewFullAutomation']();

    expect(createSpy).toHaveBeenCalledWith(
      {
        title: AUTOMATION_METADATA_STUB_TITLE,
        prompt: AUTOMATION_METADATA_STUB_PROMPT,
        evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      },
      {
        success: 'Evaluation created.',
        error: 'Could not create evaluation.',
      },
    );
    expect(page['completedEvaluationIds']()).toEqual(['eval-a']);
    expect(page['createdEvaluationId']()).toBe('eval-b');
    expect(page['activeAutomationSession']()).toEqual([{ key: '1:eval-b', evaluationId: 'eval-b' }]);
  });

  it('onRunNewFullAutomation creates with stubs when form has prior title and prompt', async () => {
    const prior = {
      id: 'eval-a',
      title: 'Evaluation A',
      prompt: 'Prompt A.',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = {
      id: 'eval-b',
      title: AUTOMATION_METADATA_STUB_TITLE,
      prompt: AUTOMATION_METADATA_STUB_PROMPT,
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].update((list) => [...list, prior]);
    page['createdEvaluationId'].set('eval-a');

    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    form!.form.controls.title.setValue('Synced title from first run');
    form!.form.controls.prompt.setValue('Synced prompt from first run.');

    const createSpy = vi.spyOn(evaluationService, 'create').mockResolvedValue(created);

    await page['onRunNewFullAutomation']();

    expect(createSpy).toHaveBeenCalledWith(
      {
        title: AUTOMATION_METADATA_STUB_TITLE,
        prompt: AUTOMATION_METADATA_STUB_PROMPT,
        evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      },
      {
        success: 'Evaluation created.',
        error: 'Could not create evaluation.',
      },
    );
    expect(form!.getValue().title).toBe('');
    expect(form!.getValue().prompt).toBe('');
  });

  it('completedEvaluationIds keeps id when active eval loses automatedAt during re-run', () => {
    const evaluation = {
      id: 'eval-rerun',
      title: 'Rerun eval',
      prompt: 'Rerun prompt.',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].update((list) => [...list, evaluation]);
    page['createdEvaluationId'].set('eval-rerun');
    page['completedEvaluationIds'].set(['eval-rerun']);

    evaluationService['evaluationsSignal'].update((list) =>
      list.map((item) =>
        item.id === 'eval-rerun' ? { ...item, automatedAt: undefined } : item,
      ),
    );

    expect(page['automationComplete']()).toBe(false);
    expect(page['completedEvaluationIds']()).toEqual(['eval-rerun']);
  });

  it('onAutomationStatusDismissed remembers completed evaluation', () => {
    const evaluation = {
      id: 'eval-dismiss-remember',
      title: 'Dismiss title',
      prompt: 'Dismiss prompt.',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      automatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    evaluationService['evaluationsSignal'].update((list) => [...list, evaluation]);
    page['createdEvaluationId'].set('eval-dismiss-remember');

    page['onAutomationStatusDismissed']();

    expect(page['completedEvaluationIds']()).toEqual(['eval-dismiss-remember']);
  });

  it('onAutomationStatusDismissed syncs evaluation into the form', () => {
    const evaluation = {
      id: 'eval-dismiss',
      title: 'Dismiss title',
      prompt: 'Dismiss prompt text for the evaluation.',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
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
    form!.form.controls.prompt.setValue('Existing prompt text that would be replaced.');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const generateTitleSpy = vi.spyOn(evaluationService, 'generateTitle');
    const generatePromptSpy = vi
      .spyOn(evaluationService, 'generatePrompt')
      .mockResolvedValue('Generated prompt from existing title.');

    await page['onGeneratePrompt']();

    expect(confirmSpy).toHaveBeenCalled();
    expect(generateTitleSpy).not.toHaveBeenCalled();
    expect(generatePromptSpy).toHaveBeenCalledWith(
      'My existing title',
      DEFAULT_EVALUATION_CONFIG,
      {
        success: 'Prompt generated.',
        error: 'Could not generate prompt.',
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('onGeneratePrompt skips generation when overwrite confirm is cancelled', async () => {
    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    form!.form.controls.title.setValue('My existing title');
    form!.form.controls.prompt.setValue('Keep this prompt text as written.');
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const generatePromptSpy = vi.spyOn(evaluationService, 'generatePrompt');

    await page['onGeneratePrompt']();

    expect(generatePromptSpy).not.toHaveBeenCalled();
    expect(form!.getValue().prompt).toBe('Keep this prompt text as written.');
  });

  it('records learn handoff when creating from learn context', async () => {
    page['fromLearn'].set(true);

    const created = {
      id: 'eval-learn',
      title: 'Learn eval',
      prompt: 'Learn prompt.',
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(evaluationService, 'create').mockResolvedValue(created);

    await page['onRunFullAutomation']();

    expect(learnHandoff.highlightedEvaluationId()).toBe('eval-learn');
  });

  it('does not record learn handoff without from=learn', async () => {
    const created = {
      id: 'eval-plain',
      title: AUTOMATION_METADATA_STUB_TITLE,
      prompt: AUTOMATION_METADATA_STUB_PROMPT,
      criteriaMode: 'default' as const,
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(evaluationService, 'create').mockResolvedValue(created);

    await page['onRunFullAutomation']();

    expect(learnHandoff.highlightedEvaluationId()).toBeNull();
  });
});
