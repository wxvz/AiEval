import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_EVALUATION_CONFIG, Evaluation } from '../../models';
import { LearnHandoffService } from '../../learn/learn-handoff.service';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { DashboardPage } from './dashboard-page';

function sampleEvaluation(id: string, updatedAt = new Date().toISOString()): Evaluation {
  return {
    id,
    title: `Evaluation ${id}`,
    prompt: 'Prompt text',
    criteriaMode: 'default',
    criteria: [],
    evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    answers: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('DashboardPage', () => {
  let fixture: ComponentFixture<DashboardPage>;
  let evaluationService: EvaluationService;
  let learnHandoff: LearnHandoffService;
  let httpMock: HttpTestingController;
  let queryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let routerNavigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionStorage.clear();
    queryParamMap$ = new BehaviorSubject(convertToParamMap({}));
    routerNavigate = vi.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        EvaluationService,
        FeedbackService,
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { queryParamMap: queryParamMap$.value };
            },
            queryParamMap: queryParamMap$.asObservable(),
          },
        },
        {
          provide: Router,
          useValue: { navigate: routerNavigate },
        },
      ],
    }).compileComponents();

    evaluationService = TestBed.inject(EvaluationService);
    learnHandoff = TestBed.inject(LearnHandoffService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPage);
  });

  it('shows learn banner when handoff is active', () => {
    learnHandoff.recordEvaluation('eval-learn', 'first-evaluation-lab');
    evaluationService['evaluationsSignal'].set([sampleEvaluation('eval-learn')]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Learn lab');
    expect(el.textContent).toContain('Compare answers');
  });

  it('hides learn banner after dismiss', () => {
    learnHandoff.recordEvaluation('eval-learn', 'first-evaluation-lab');
    evaluationService['evaluationsSignal'].set([sampleEvaluation('eval-learn')]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    fixture.componentInstance['dismissLearnBanner']();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Your evaluation from the First evaluation lab');
  });

  it('highlights evaluation card from learn handoff', () => {
    learnHandoff.recordEvaluation('eval-highlight', 'first-evaluation-lab');
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

  it('defaults to the highlighted Learn evaluation day when it is available', () => {
    const newest = sampleEvaluation('newest', new Date(2025, 5, 20, 12).toISOString());
    const highlighted = sampleEvaluation('eval-highlight', new Date(2025, 4, 10, 12).toISOString());
    learnHandoff.recordEvaluation(highlighted.id, 'first-evaluation-lab');
    evaluationService['evaluationsSignal'].set([newest, highlighted]);
    evaluationService['loadingSignal'].set(false);

    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-evaluation-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain(highlighted.title);
  });

  it('defaults to the newest day without a Learn handoff', () => {
    const newest = sampleEvaluation('newest', new Date(2025, 5, 20, 12).toISOString());
    const older = sampleEvaluation('older', new Date(2025, 4, 10, 12).toISOString());
    evaluationService['evaluationsSignal'].set([older, newest]);
    evaluationService['loadingSignal'].set(false);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-evaluation-card').textContent).toContain(
      newest.title,
    );
  });

  it('shows only evaluations from the selected day and reconciles a removed day', () => {
    const newest = sampleEvaluation('newest', new Date(2025, 5, 20, 12).toISOString());
    const older = sampleEvaluation('older', new Date(2025, 4, 10, 12).toISOString());
    evaluationService['evaluationsSignal'].set([newest, older]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    fixture.componentInstance['selectDay']('2025-05-10');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-evaluation-card').textContent).toContain(
      older.title,
    );

    evaluationService['evaluationsSignal'].set([newest]);
    fixture.detectChanges();
    expect(fixture.componentInstance['selectedDayKey']()).toBe('2025-06-20');
    expect(fixture.nativeElement.querySelector('app-evaluation-card').textContent).toContain(
      newest.title,
    );
  });

  it('keeps a separate pagination index for each selected day', () => {
    const firstDay = Array.from({ length: 7 }, (_, index) =>
      sampleEvaluation(`first-${index}`, new Date(2025, 5, 20, 12, index).toISOString()),
    );
    const secondDay = Array.from({ length: 7 }, (_, index) =>
      sampleEvaluation(`second-${index}`, new Date(2025, 5, 19, 12, index).toISOString()),
    );
    evaluationService['evaluationsSignal'].set([...firstDay, ...secondDay]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    fixture.componentInstance['setDayPage']('2025-06-20', 1, 7);
    fixture.componentInstance['selectDay']('2025-06-19');
    fixture.componentInstance['setDayPage']('2025-06-19', 1, 7);
    fixture.componentInstance['selectDay']('2025-06-20');
    fixture.detectChanges();

    expect(
      fixture.componentInstance['dayPageIndex'](fixture.componentInstance['selectedDayGroup']()!),
    ).toBe(1);
    const cards = fixture.nativeElement.querySelectorAll('app-evaluation-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Evaluation first-6');
  });

  it('opens Compare for the requested lab handoff, not another active lab', () => {
    learnHandoff.recordEvaluation('eval-support', 'support-bot-decision-lab');
    evaluationService['evaluationsSignal'].set([sampleEvaluation('eval-support')]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    routerNavigate.mockClear();
    queryParamMap$.next(
      convertToParamMap({
        from: 'learn',
        learnLesson: 'first-evaluation-lab',
        openCompare: '1',
      }),
    );
    fixture.detectChanges();

    expect(fixture.componentInstance['openCompareMiss']()).toContain('Compare is unavailable');
    expect(routerNavigate).toHaveBeenCalledWith([], {
      relativeTo: expect.anything(),
      queryParams: { openCompare: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });

    routerNavigate.mockClear();
    fixture.componentInstance['openCompareMiss'].set(null);
    queryParamMap$.next(
      convertToParamMap({
        from: 'learn',
        learnLesson: 'support-bot-decision-lab',
        openCompare: '1',
      }),
    );
    fixture.detectChanges();

    expect(fixture.componentInstance['openCompareMiss']()).toBeNull();
    expect(routerNavigate).toHaveBeenCalledWith(['/evaluations', 'eval-support', 'compare'], {
      replaceUrl: true,
    });
  });


  it('hides Learn banner and highlight when the requested lab has no handoff', () => {
    learnHandoff.recordEvaluation('eval-first', 'first-evaluation-lab');
    evaluationService['evaluationsSignal'].set([sampleEvaluation('eval-first')]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    expect(fixture.componentInstance['showLearnBanner']()).toBe(true);
    expect(fixture.componentInstance['highlightedEvaluationId']()).toBe('eval-first');

    queryParamMap$.next(
      convertToParamMap({
        from: 'learn',
        learnLesson: 'support-bot-decision-lab',
      }),
    );
    fixture.detectChanges();

    expect(fixture.componentInstance['showLearnBanner']()).toBe(false);
    expect(fixture.componentInstance['highlightedEvaluationId']()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('From Learn lab');
  });

  it('keeps Learn handoff when evaluation delete fails', () => {
    const evaluation = sampleEvaluation('eval-learn');
    learnHandoff.recordEvaluation(evaluation.id, 'first-evaluation-lab');
    evaluationService['evaluationsSignal'].set([evaluation]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    fixture.componentInstance['deleteTargetId'].set(evaluation.id);
    fixture.componentInstance['confirmDelete']();

    expect(learnHandoff.hasHandoffForLesson('first-evaluation-lab')).toBe(true);
    httpMock
      .expectOne(`/api/evaluations/${evaluation.id}`)
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    expect(learnHandoff.hasHandoffForLesson('first-evaluation-lab')).toBe(true);
    expect(learnHandoff.evaluationIdForLesson('first-evaluation-lab')).toBe(evaluation.id);
  });

  it('clears Learn handoff only after evaluation delete succeeds', () => {
    const evaluation = sampleEvaluation('eval-learn');
    learnHandoff.recordEvaluation(evaluation.id, 'first-evaluation-lab');
    evaluationService['evaluationsSignal'].set([evaluation]);
    evaluationService['loadingSignal'].set(false);
    fixture.detectChanges();

    fixture.componentInstance['deleteTargetId'].set(evaluation.id);
    fixture.componentInstance['confirmDelete']();

    expect(learnHandoff.hasHandoffForLesson('first-evaluation-lab')).toBe(true);
    httpMock.expectOne(`/api/evaluations/${evaluation.id}`).flush(null);
    expect(learnHandoff.hasHandoffForLesson('first-evaluation-lab')).toBe(false);
  });
});
