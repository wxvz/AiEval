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

  it('renders key terms saved from lesson body expanded by default', () => {
    fixture.componentRef.setInput('content', loadLessonContent('learning-from-examples'));
    fixture.componentRef.setInput('sectionsSolved', [false, false, false]);
    fixture.componentRef.setInput('locked', false);
    fixture.componentRef.setInput('savedKeyTerms', ['model', 'target']);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Key terms');
    expect(el.textContent).toContain('model');
    expect(el.textContent).toContain('target');
    expect(el.querySelectorAll('.learn-lesson-rail__key-term-body').length).toBe(2);

    const toggle = el.querySelector('.learn-lesson-rail__key-term-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    toggle.click();
    fixture.detectChanges();

    expect(el.querySelectorAll('.learn-lesson-rail__key-term-body').length).toBe(1);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps a manually collapsed term closed when another term is saved', () => {
    fixture.componentRef.setInput('locked', false);
    fixture.componentRef.setInput('savedKeyTerms', ['model']);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const toggle = el.querySelector('.learn-lesson-rail__key-term-toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fixture.componentRef.setInput('savedKeyTerms', ['target', 'model']);
    fixture.detectChanges();

    const toggles = el.querySelectorAll(
      '.learn-lesson-rail__key-term-toggle',
    ) as NodeListOf<HTMLButtonElement>;
    expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
    expect(toggles[1].getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelectorAll('.learn-lesson-rail__key-term-body').length).toBe(1);
  });
});
