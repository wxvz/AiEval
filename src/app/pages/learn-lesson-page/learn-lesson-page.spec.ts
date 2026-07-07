import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnLessonPage } from './learn-lesson-page';

describe('LearnLessonPage', () => {
  let fixture: ComponentFixture<LearnLessonPage>;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [LearnLessonPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ lessonId: '' }) } },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  function setLessonId(lessonId: string): void {
    const route = TestBed.inject(ActivatedRoute);
    vi.spyOn(route.snapshot.paramMap, 'get').mockReturnValue(lessonId);
  }

  it('shows empty state for stub lesson content', () => {
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
    expect(el.textContent).toContain('Content coming soon');
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

  it('shows optional lab link on train-vs-test lesson', () => {
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['learning-from-examples']));
    setLessonId('train-vs-test');
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Optional — try it yourself');
    expect(el.querySelector('a[href="/learn/labs/train-vs-test"]')).toBeTruthy();
  });

  it('redirects unknown lesson ids to /learn', () => {
    setLessonId('not-real');
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(LearnLessonPage);
    fixture.detectChanges();
    expect(navigateSpy).toHaveBeenCalledWith(['/learn']);
  });
});
