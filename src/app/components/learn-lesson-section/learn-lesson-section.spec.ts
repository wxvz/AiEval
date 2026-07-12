import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

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

  it('shows collapsible header and explanation after a correct answer', () => {
    fixture.componentRef.setInput('solved', true);
    fixture.detectChanges();
    fixture.componentInstance.onSolved(true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button.learn-lesson-section__collapsed--open')).toBeTruthy();
    expect(el.textContent).toContain('Complete');
    expect(el.textContent).toContain('Paragraph one.');
    expect(el.textContent).toContain('Why this answer');
    expect(el.textContent).toContain('Because B matches the teaching point.');
  });

  it('collapses only when the learner clicks the section header', () => {
    const collapsed: boolean[] = [];
    fixture.componentInstance.collapsedChange.subscribe((value) => collapsed.push(value));

    fixture.componentRef.setInput('solved', true);
    fixture.detectChanges();
    expect(collapsed).toEqual([]);

    fixture.componentInstance.toggleCollapsed();
    expect(collapsed).toEqual([true]);

    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Why this answer');
    expect(el.querySelector('button.learn-lesson-section__collapsed--open')).toBeFalsy();
  });

  it('shows explanation again when reopened after collapse', () => {
    fixture.componentRef.setInput('solved', true);
    fixture.componentRef.setInput('collapsed', true);
    fixture.detectChanges();

    fixture.componentInstance.toggleCollapsed();
    fixture.componentRef.setInput('collapsed', false);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Why this answer');
    expect(el.textContent).toContain('Because B matches the teaching point.');
  });
});
