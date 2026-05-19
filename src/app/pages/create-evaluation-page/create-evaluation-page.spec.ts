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
    const fixture = TestBed.createComponent(CreateEvaluationPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('onRunFullAutomation creates stub evaluation without filling the form', async () => {
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
