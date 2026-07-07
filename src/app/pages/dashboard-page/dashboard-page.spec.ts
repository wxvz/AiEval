import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { Evaluation } from '../../models';
import { LearnHandoffService } from '../../learn/learn-handoff.service';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { DashboardPage } from './dashboard-page';

function sampleEvaluation(id: string): Evaluation {
  return {
    id,
    title: `Evaluation ${id}`,
    prompt: 'Prompt text',
    criteriaMode: 'default',
    criteria: [],
    answers: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let evaluationService: EvaluationService;
  let learnHandoff: LearnHandoffService;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        EvaluationService,
        FeedbackService,
      ],
    }).compileComponents();

    evaluationService = TestBed.inject(EvaluationService);
    learnHandoff = TestBed.inject(LearnHandoffService);
    fixture = TestBed.createComponent(DashboardPage);
  });

  it('shows learn banner when handoff is active', () => {
    learnHandoff.recordEvaluation('eval-learn');
    evaluationService['evaluationsSignal'].set([sampleEvaluation('eval-learn')]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Learn lab');
    expect(el.textContent).toContain('Compare answers');
  });

  it('hides learn banner after dismiss', () => {
    learnHandoff.recordEvaluation('eval-learn');
    evaluationService['evaluationsSignal'].set([sampleEvaluation('eval-learn')]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    fixture.componentInstance['dismissLearnBanner']();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Your evaluation from the First evaluation lab');
  });

  it('highlights evaluation card from learn handoff', () => {
    learnHandoff.recordEvaluation('eval-highlight');
    evaluationService['evaluationsSignal'].set([
      sampleEvaluation('other'),
      sampleEvaluation('eval-highlight'),
    ]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    const highlighted = fixture.nativeElement.querySelector('.evaluation-card--highlighted');
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toContain('From Learn lab');
  });
});
