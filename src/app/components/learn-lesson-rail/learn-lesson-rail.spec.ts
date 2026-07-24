import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { getLesson } from '../../learn/curriculum';
import { loadLessonContent } from '../../learn/learn-content';
import { LearnLessonRail } from './learn-lesson-rail';

describe('LearnLessonRail', () => {
  let fixture: ComponentFixture<LearnLessonRail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LearnLessonRail],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LearnLessonRail);
    fixture.componentRef.setInput('lesson', getLesson('learning-from-examples'));
    fixture.componentRef.setInput('trackLabel', 'Foundation');
    fixture.componentRef.setInput('content', loadLessonContent('learning-from-examples'));
  });

  it('renders lesson context and the sections TOC', () => {
    fixture.componentRef.setInput('sectionsSolved', [true, false, false]);
    fixture.componentRef.setInput('activeSectionIndex', 1);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Foundation');
    expect(el.textContent).toContain('Learning from examples');
    expect(el.textContent).toContain('Sections');
    expect(el.textContent).toContain('Learning like flash cards');
    expect(el.querySelector('.learn-lesson-rail__toc-item--active')?.textContent).toContain(
      'See inputs paired with targets',
    );
    expect(el.querySelectorAll('.learn-lesson-rail__num').length).toBe(3);
  });

  it('renders key terms below the sections TOC when unlocked', () => {
    fixture.componentRef.setInput('sectionsSolved', [false, false, false]);
    fixture.componentRef.setInput('locked', false);
    fixture.componentRef.setInput('savedKeyTerms', ['model', 'target']);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.learn-lesson-rail__key-terms')).toBeTruthy();
    expect(el.textContent).toContain('Key terms');
    expect(el.textContent).toContain('model');
    expect(el.textContent).toContain('target');
  });

  it('hides key terms when locked', () => {
    fixture.componentRef.setInput('sectionsSolved', [false, false, false]);
    fixture.componentRef.setInput('locked', true);
    fixture.componentRef.setInput('savedKeyTerms', ['model']);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.learn-lesson-rail__key-terms')).toBeFalsy();
  });
});
