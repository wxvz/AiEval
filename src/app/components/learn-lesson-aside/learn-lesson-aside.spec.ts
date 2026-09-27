import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLesson } from '../../learn/curriculum';
import { loadLessonContent } from '../../learn/learn-content';
import { LearnLessonAside } from './learn-lesson-aside';

describe('LearnLessonAside', () => {
  let fixture: ComponentFixture<LearnLessonAside>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LearnLessonAside],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LearnLessonAside);
  });

  it('renders section progress without the left-rail section TOC', () => {
    const content = loadLessonContent('learning-from-examples');
    fixture.componentRef.setInput('content', content);
    fixture.componentRef.setInput('sectionsSolved', [true, false, false]);
    fixture.componentRef.setInput('recapCount', 2);
    fixture.componentRef.setInput('recapSolved', [false, false]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Progress');
    expect(el.textContent).toContain('1 of 3 sections');
    expect(el.textContent).toContain('1 of 5 checks done');
    expect(el.textContent).not.toContain('Sections');
    expect(el.textContent).not.toContain('Learning like flash cards');
  });

  it('renders optional lab, tip and mark complete when unlocked', () => {
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['train-vs-test']));
    fixture.componentRef.setInput('content', loadLessonContent('prompts-as-instructions'));
    fixture.componentRef.setInput('sectionsSolved', [false, false, false]);
    fixture.componentRef.setInput('recapCount', 0);
    fixture.componentRef.setInput('locked', false);
    fixture.componentRef.setInput('savedKeyTerms', ['model', 'target']);
    fixture.componentRef.setInput(
      'activeAside',
      loadLessonContent('prompts-as-instructions')?.sections[0]?.aside ?? null,
    );
    fixture.componentRef.setInput('optionalLab', getLesson('train-vs-test-lab')!);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Key terms');
    expect(el.textContent).toContain('Optional · try it yourself');
    expect(el.querySelector('a[href="/learn/labs/train-vs-test"]')).toBeTruthy();
    expect(el.textContent).toContain('Try in AiEval');
    expect(el.textContent).toContain('New evaluation');
    const tipLink = el.querySelector(
      'a[href="/evaluations/new?from=learn"]',
    ) as HTMLAnchorElement | null;
    expect(tipLink).toBeTruthy();
    expect(tipLink?.getAttribute('href')).not.toContain('%3F');
    expect(el.querySelector('button.learn-lesson-aside__complete-btn')?.textContent).toContain(
      'Mark complete',
    );
  });

  it('renders branch practice links for the parent lesson', () => {
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['softmax-and-distributions']));
    fixture.componentRef.setInput('content', loadLessonContent('softmax-and-distributions'));
    fixture.componentRef.setInput('locked', false);
    fixture.componentRef.setInput('currentLessonRoute', '/learn/lessons/softmax-and-distributions');
    fixture.componentRef.setInput('branchLessons', [
      getLesson('softmax-and-distributions-lab')!,
      getLesson('neural-network-lab')!,
    ]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Practice · try it yourself');
    expect(el.textContent).toContain('Softmax lab');
    expect(el.textContent).toContain('Neural network lab');
    expect(el.querySelector('a[href="/learn/labs/softmax"]')).toBeTruthy();
    expect(el.querySelector('a[href="/learn/labs/neural-network"]')).toBeTruthy();
  });

  it('shows disabled self-complete CTA when branch lab prereq is the current lesson', () => {
    fixture.componentRef.setInput('content', loadLessonContent('softmax-and-distributions'));
    fixture.componentRef.setInput('locked', false);
    fixture.componentRef.setInput('currentLessonRoute', '/learn/lessons/softmax-and-distributions');
    fixture.componentRef.setInput('branchLessons', [getLesson('softmax-and-distributions-lab')!]);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const selfLink = el.querySelector(
      'a[href="/learn/lessons/softmax-and-distributions"]',
    );
    const disabledBtn = el.querySelector(
      'button[disabled][title="Mark this lesson complete first"]',
    );

    expect(selfLink).toBeFalsy();
    expect(disabledBtn).toBeTruthy();
    expect(el.textContent).toContain('Mark this lesson complete first');
  });

  it('hides optional lab, tip and nav when locked', () => {
    fixture.componentRef.setInput('content', loadLessonContent('prompts-as-instructions'));
    fixture.componentRef.setInput('sectionsSolved', [false, false, false]);
    fixture.componentRef.setInput('locked', true);
    fixture.componentRef.setInput('savedKeyTerms', ['model']);
    fixture.componentRef.setInput(
      'activeAside',
      loadLessonContent('prompts-as-instructions')?.sections[0]?.aside ?? null,
    );
    fixture.componentRef.setInput('optionalLab', getLesson('train-vs-test-lab')!);
    fixture.componentRef.setInput('branchLessons', [getLesson('neural-network-lab')!]);
    fixture.componentRef.setInput('adjacent', {
      previous: { id: 'x', title: 'Prev', route: '/learn/lessons/x' } as never,
      next: { id: 'y', title: 'Next', route: '/learn/lessons/y' } as never,
    });
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Progress');
    expect(el.textContent).not.toContain('Optional · try it yourself');
    expect(el.textContent).not.toContain('Practice · try it yourself');
    expect(el.textContent).not.toContain('Try in AiEval');
    expect(el.textContent).not.toContain('Key terms');
    expect(el.querySelector('.learn-lesson-aside__nav-link')).toBeFalsy();
    expect(el.querySelector('button.learn-lesson-aside__complete-btn')).toBeFalsy();
  });

  it('emits markComplete from the aside button', () => {
    fixture.componentRef.setInput('content', loadLessonContent('learning-from-examples'));
    fixture.componentRef.setInput('sectionsSolved', [true, true, true]);
    fixture.componentRef.setInput('locked', false);
    fixture.componentRef.setInput('markCompleteEnabled', true);
    const emitSpy = vi.spyOn(fixture.componentInstance.markComplete, 'emit');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button.learn-lesson-aside__complete-btn') as HTMLButtonElement).click();
    expect(emitSpy).toHaveBeenCalledOnce();
  });
});
