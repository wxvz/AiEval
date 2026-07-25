import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnHandoffService } from '../../learn/learn-handoff.service';
import { DEFAULT_EVALUATION_CONFIG } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import { LearnWalkthroughPage } from './learn-walkthrough-page';

describe('LearnWalkthroughPage', () => {
  let fixture: ComponentFixture<LearnWalkthroughPage>;
  let handoff: LearnHandoffService;
  let evaluations: EvaluationService;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['outside-eval-practice']));
    await TestBed.configureTestingModule({
      imports: [LearnWalkthroughPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        EvaluationService,
        FeedbackService,
        provideRouter([
          {
            path: '**',
            component: LearnWalkthroughPage,
            data: { lessonId: 'first-evaluation-lab' },
          },
        ]),
      ],
    }).compileComponents();
    handoff = TestBed.inject(LearnHandoffService);
    evaluations = TestBed.inject(EvaluationService);
    fixture = TestBed.createComponent(LearnWalkthroughPage);
    fixture.detectChanges();
  });

  it('renders walkthrough steps from JSON', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Open create with the Acme warm-up');
    expect(el.textContent).toContain('Create evaluation');
    expect(el.querySelector('.learn-walkthrough-step')).toBeTruthy();
  });

  it('shows dynamic track label and flow diagram', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('LLM systems');
    expect(el.querySelector('.learn-lab-diagram')).toBeTruthy();
  });

  it('renders common questions and review link', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Common questions');
    expect(el.querySelector('.learn-lab-faq')).toBeTruthy();
    const reviewLink: HTMLAnchorElement | null = el.querySelector(
      'a[href="/learn/lessons/outside-eval-practice"]',
    );
    expect(reviewLink?.textContent).toContain('Outside eval practice');
  });

  it('disables mark lab complete until a handoff exists', () => {
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'app-learn-lab-nav button',
    );
    expect(button?.textContent?.trim()).toBe('Mark lab complete');
    expect(button?.disabled).toBe(true);
  });

  it('enables mark lab complete after an automated handoff for this lesson', () => {
    handoff.recordEvaluation('eval-learn', 'first-evaluation-lab');
    evaluations['evaluationsSignal'].set([
      {
        id: 'eval-learn',
        title: 'Learn eval',
        prompt: 'Prompt',
        criteriaMode: 'default',
        criteria: [],
        evaluationConfig: DEFAULT_EVALUATION_CONFIG,
        answers: [],
        automatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    fixture.detectChanges();
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'app-learn-lab-nav button',
    );
    expect(button?.disabled).toBe(false);
  });

  it('splits actionRoute query params for create and dashboard links', () => {
    const el: HTMLElement = fixture.nativeElement;
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href'));

    expect(hrefs).toContain('/evaluations/new?from=learn&learnLesson=first-evaluation-lab');
    expect(hrefs).toContain('/?from=learn&learnLesson=first-evaluation-lab');
    expect(hrefs.some((href) => href?.includes('%3Ffrom'))).toBe(false);
    expect(
      fixture.componentInstance.actionPath(
        '/evaluations/new?from=learn&learnLesson=first-evaluation-lab',
      ),
    ).toBe('/evaluations/new');
    expect(
      fixture.componentInstance.actionQueryParams(
        '/evaluations/new?from=learn&learnLesson=first-evaluation-lab',
      ),
    ).toEqual({
      from: 'learn',
      learnLesson: 'first-evaluation-lab',
    });
    expect(
      fixture.componentInstance.actionQueryParams(
        '/?from=learn&learnLesson=first-evaluation-lab&openCompare=1',
      ),
    ).toEqual({ from: 'learn', learnLesson: 'first-evaluation-lab', openCompare: '1' });
  });
});
