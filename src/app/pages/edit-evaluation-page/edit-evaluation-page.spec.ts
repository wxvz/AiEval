import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { LeaveDuringAutomationComponent } from '../../components/leave-during-automation/leave-during-automation';
import { DEFAULT_EVALUATION_CONFIG, Evaluation } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { TemplateService } from '../../services/template.service';
import { EditEvaluationPage } from './edit-evaluation-page';

describe('EditEvaluationPage.canDeactivate', () => {
  let page: EditEvaluationPage;
  let fixture: ComponentFixture<EditEvaluationPage>;
  let evaluationService: EvaluationService;

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

  beforeEach(() => {
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
        TemplateService,
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

    fixture = TestBed.createComponent(EditEvaluationPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  function leaveDuringAutomation(): LeaveDuringAutomationComponent {
    const debugElement = fixture.debugElement.query(By.directive(LeaveDuringAutomationComponent));

    expect(debugElement).toBeTruthy();

    return debugElement.componentInstance as LeaveDuringAutomationComponent;
  }

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

    leaveDuringAutomation()['onLeaveCancelled']();

    await expect(result).resolves.toBe(false);
    expect(evaluationService.automatingEvaluationId()).toBe('eval-1');
  });

  it('returns the same promise when canDeactivate is called twice while automating', async () => {
    evaluationService.automatingEvaluationId.set('eval-1');

    const first = page.canDeactivate();
    const second = page.canDeactivate();

    expect(first).toBe(second);

    leaveDuringAutomation()['onLeaveCancelled']();

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
  });

  it('returns a promise that resolves true and cancels automation when user leaves', async () => {
    evaluationService.automatingEvaluationId.set('eval-1');
    const cancelSpy = vi.spyOn(evaluationService, 'cancelAutomation');

    const result = page.canDeactivate();

    leaveDuringAutomation()['onLeaveConfirmed']();

    await expect(result).resolves.toBe(true);
    expect(cancelSpy).toHaveBeenCalledWith('eval-1');
  });

});
