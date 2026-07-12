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
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Foundation');
    expect(el.textContent).toContain('Learning from examples');
    expect(el.textContent).toContain('Sections');
    expect(el.textContent).toContain('Learning like flash cards');
    expect(el.textContent).toContain('✓');
  });

  it('renders key terms saved from lesson body collapsed by default', () => {
    fixture.componentRef.setInput('content', loadLessonContent('learning-from-examples'));
    fixture.componentRef.setInput('sectionsSolved', [false, false, false]);
    fixture.componentRef.setInput('locked', false);
    fixture.componentRef.setInput('savedKeyTerms', ['model', 'target']);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Key terms');
    expect(el.textContent).toContain('model');
    expect(el.textContent).toContain('target');
    expect(el.querySelector('.learn-lesson-rail__key-term-body')).toBeFalsy();

    const toggle = el.querySelector('.learn-lesson-rail__key-term-toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(el.querySelector('.learn-lesson-rail__key-term-body')).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
