import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

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

  it('onRunFullAutomation sets createdEvaluationId without navigating', async () => {
    const created = {
      id: 'eval-new',
      title: 'My eval',
      prompt: 'A long enough prompt for validation.',
      criteriaMode: 'default' as const,
      criteria: [],
      answers: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(evaluationService, 'create').mockResolvedValue(created);

    const form = page['evaluationForm']();

    expect(form).toBeTruthy();

    form!.setPrompt(created.prompt);
    form!.form.controls.title.setValue(created.title);

    await page['onRunFullAutomation']();

    expect(page['createdEvaluationId']()).toBe('eval-new');
    expect(routerNavigate).not.toHaveBeenCalled();
  });
});
