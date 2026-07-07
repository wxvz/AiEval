import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnLessonSection } from './learn-lesson-section';

describe('LearnLessonSection', () => {
  let fixture: ComponentFixture<LearnLessonSection>;

  const section = {
    title: 'Test section',
    paragraphs: ['Paragraph one.'],
    check: {
      prompt: 'Pick one.',
      answer: 'B is right',
      choices: ['A is wrong', 'B is right', 'C is wrong'],
      explanation: 'Because B matches the teaching point.',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LearnLessonSection],
    }).compileComponents();
    fixture = TestBed.createComponent(LearnLessonSection);
    fixture.componentRef.setInput('section', section);
    fixture.componentRef.setInput('sectionIndex', 0);
    fixture.detectChanges();
  });

  it('shows teaching content when not solved', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Paragraph one.');
    expect(el.querySelector('button.learn-lesson-section__collapsed')).toBeFalsy();
  });

  it('collapses after a correct answer', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('solved', true);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.onSolved(true);
    vi.advanceTimersByTime(700);
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button.learn-lesson-section__collapsed')).toBeTruthy();
    expect(el.textContent).toContain('Complete');
    vi.useRealTimers();
  });

  it('shows explanation when reopened after collapse', () => {
    fixture.componentRef.setInput('solved', true);
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.toggleCollapsed();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Why this answer');
    expect(el.textContent).toContain('Because B matches the teaching point.');
  });
});
