import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnLessonPage } from './learn-lesson-page';

describe('LearnLessonPage', () => {
  let fixture: ComponentFixture<LearnLessonPage>;
  let router: Router;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    paramMap$ = new BehaviorSubject(convertToParamMap({ lessonId: '' }));
    TestBed.configureTestingModule({
      imports: [LearnLessonPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            get snapshot() {
              return { paramMap: paramMap$.value };
            },
            paramMap: paramMap$.asObservable(),
          },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  function setLessonId(lessonId: string): void {
    paramMap$.next(convertToParamMap({ lessonId }));
  }

  it('renders lesson body for prompts-as-instructions', () => {
    localStorage.setItem(
      'aieval-learn-progress',
      JSON.stringify([
        'learning-from-examples',
        'train-vs-test',
        'loss-and-updates',
        'neural-network-lab',
      ]),
    );
    setLessonId('prompts-as-instructions');
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Prompts as instructions');
    expect(el.textContent).not.toContain('Content coming soon');
    expect(el.querySelector('app-learn-lesson-section')).toBeTruthy();
  });

  it('renders section checks and recap without legacy Check yourself heading', () => {
    setLessonId('learning-from-examples');
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Recap');
    expect(el.textContent).not.toContain('Check yourself');
    expect(el.querySelector('app-learn-lesson-section')).toBeTruthy();
    expect(el.querySelectorAll('app-learn-check-question').length).toBeGreaterThan(0);
  });

  it('disables mark complete until checks are solved', () => {
    setLessonId('learning-from-examples');
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.learn-lesson-footer button.btn-primary'),
    ) as HTMLButtonElement[];
    const markButton = buttons.find((button) => button.textContent?.includes('Mark complete'));
    expect(markButton?.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Answer all section checks and recap questions first',
    );
  });

  it('shows optional lab link in sidebar on train-vs-test lesson', () => {
    localStorage.setItem(
      'aieval-learn-progress',
      JSON.stringify(['learning-from-examples', 'what-is-a-dataset']),
    );
    setLessonId('train-vs-test');
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Optional: try it yourself');
    expect(el.querySelector('app-learn-lesson-aside a[href="/learn/labs/train-vs-test"]')).toBeTruthy();
    expect(el.querySelector('.learn-lesson-footer a[href="/learn/labs/train-vs-test"]')).toBeFalsy();
  });

  it('uses the three-column shell with lesson rail and aside', () => {
    localStorage.setItem(
      'aieval-learn-progress',
      JSON.stringify([
        'learning-from-examples',
        'train-vs-test',
        'loss-and-updates',
        'neural-network-lab',
      ]),
    );
    setLessonId('prompts-as-instructions');
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-page-shell')).toBeTruthy();
    expect(el.querySelector('app-learn-lesson-rail[shellleft]')).toBeTruthy();
    expect(el.querySelector('app-learn-lesson-aside')).toBeTruthy();
    expect(el.querySelector('app-learn-lesson-aside[shellright]')).toBeTruthy();
    expect(el.querySelector('app-learn-lesson-rail')?.textContent).toContain('Sections');
    expect(el.querySelector('app-learn-lesson-aside')?.textContent).not.toContain('Sections');
    expect(el.textContent).toContain('Try in AiEval');
  });

  it('keeps completion in the main column and navigation only in the aside', () => {
    setLessonId('learning-from-examples');
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[shellmain] .learn-lesson-footer button')).toBeTruthy();
    expect(el.querySelector('.learn-lesson-footer a')).toBeFalsy();
    expect(el.querySelector('app-learn-lesson-aside nav[aria-label="Lesson navigation"]')).toBeTruthy();
  });

  it('redirects unknown lesson ids to /learn', () => {
    setLessonId('not-real');
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    expect(navigateSpy).toHaveBeenCalledWith(['/learn']);
  });

  it('updates key terms when a highlighted word is tapped', () => {
    setLessonId('learning-from-examples');
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector(
      'app-learn-term-hint button.learn-term-hint__trigger',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    trigger.click();
    fixture.detectChanges();

    const rail = fixture.nativeElement.querySelector('.learn-lesson-rail__key-terms');
    expect(rail).toBeTruthy();
    expect(rail.textContent).toContain('Key terms');
    expect(rail.querySelector('.learn-lesson-rail__key-term-body')).toBeTruthy();
    expect(
      rail.querySelector('.learn-lesson-rail__key-term-toggle')?.getAttribute('aria-expanded'),
    ).toBe('true');

    const savedMentions = fixture.nativeElement.querySelectorAll('.learn-term-hint__saved');
    expect(savedMentions.length).toBeGreaterThan(0);
  });

  it('updates lesson content when the route lessonId changes', () => {
    setLessonId('learning-from-examples');
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Learning from examples');

    setLessonId('train-vs-test');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Train vs test');
    expect(fixture.nativeElement.textContent).not.toContain('Learning from examples');
  });
});
