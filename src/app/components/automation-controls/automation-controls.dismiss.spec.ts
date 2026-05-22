import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Evaluation } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { SettingsService } from '../../services/settings.service';
import { AutomationControlsComponent } from './automation-controls';

describe('AutomationControlsComponent dismiss', () => {
  let component: AutomationControlsComponent;
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

  it('cancels automation on dismiss when still automating', () => {
    evaluationService.automatingEvaluationId.set('eval-1');
    const cancelSpy = vi.spyOn(evaluationService, 'cancelAutomation');
    const dismissed = vi.fn();

    component.statusDismissed.subscribe(dismissed);

    component['onDismissAutomationStatus']();

    expect(cancelSpy).toHaveBeenCalledWith('eval-1');
    expect(dismissed).toHaveBeenCalled();
  });

  it('does not cancel automation on dismiss when already idle', () => {
    evaluationService.automatingEvaluationId.set(null);
    const cancelSpy = vi.spyOn(evaluationService, 'cancelAutomation');

    component['onDismissAutomationStatus']();

    expect(cancelSpy).not.toHaveBeenCalled();
  });
});
