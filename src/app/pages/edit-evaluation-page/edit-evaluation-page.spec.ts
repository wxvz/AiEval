import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { Evaluation } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { EditEvaluationPage } from './edit-evaluation-page';

describe('EditEvaluationPage.canDeactivate', () => {
  let page: EditEvaluationPage;
  let evaluationService: EvaluationService;

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
    const modalElement = document.createElement('div');
    modalElement.id = 'confirmLeaveDuringAutomationModal';
    document.body.appendChild(modalElement);

    vi.stubGlobal('bootstrap', {
      Modal: {
        getOrCreateInstance: () => ({ show: vi.fn(), hide: vi.fn() }),
      },
    });

    TestBed.configureTestingModule({
      imports: [EditEvaluationPage],
      providers: [
        provideHttpClient(),
        EvaluationService,
        FeedbackService,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: 'eval-1' }) },
          },
        },
      ],
    });

    evaluationService = TestBed.inject(EvaluationService);
    evaluationService['evaluationsSignal'].set([evaluation]);

    const fixture = TestBed.createComponent(EditEvaluationPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('returns true when automation is not running', () => {
    expect(page.canDeactivate()).toBe(true);
  });

  it('sets returnValue on beforeunload when automating', () => {
    evaluationService.automatingEvaluationId.set('eval-1');
    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefault = vi.spyOn(event, 'preventDefault');

    page.onBeforeUnload(event);

    expect(preventDefault).toHaveBeenCalled();
    // jsdom coerces '' to true; browsers use the assigned string for the dialog.
    expect(event.returnValue).toBeTruthy();
  });

  it('returns a promise that resolves false when user stays', async () => {
    evaluationService.automatingEvaluationId.set('eval-1');

    const result = page.canDeactivate();

    expect(result).toBeInstanceOf(Promise);

    page['onLeaveCancelled']();

    await expect(result).resolves.toBe(false);
    expect(evaluationService.automatingEvaluationId()).toBe('eval-1');
  });

  it('returns a promise that resolves true and cancels automation when user leaves', async () => {
    evaluationService.automatingEvaluationId.set('eval-1');
    const cancelSpy = vi.spyOn(evaluationService, 'cancelAutomation');

    const result = page.canDeactivate();

    page['onLeaveConfirmed']();

    await expect(result).resolves.toBe(true);
    expect(cancelSpy).toHaveBeenCalledWith('eval-1');
  });

});
