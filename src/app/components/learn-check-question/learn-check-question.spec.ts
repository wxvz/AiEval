import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnCheckQuestion } from './learn-check-question';

describe('LearnCheckQuestion', () => {
  let fixture: ComponentFixture<LearnCheckQuestion>;
  let component: LearnCheckQuestion;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LearnCheckQuestion],
    }).compileComponents();
    fixture = TestBed.createComponent(LearnCheckQuestion);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('question', {
      prompt: 'What is supervised learning?',
      answer: 'Learning from labeled examples.',
      accept: ['learning from examples with targets'],
      explanation: 'Supervised learning uses labeled input–target pairs.',
    });
    fixture.detectChanges();
  });

  it('shows success and hides answer card on correct check', () => {
    component.onInputChange('learning from examples with targets');
    component.check();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Correct!');
    expect(el.textContent).not.toContain('Why this answer');
  });

  it('reveals answer card on incorrect check', () => {
    component.onInputChange('wrong guess');
    component.check();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Answer');
    expect(el.textContent).toContain('Learning from labeled examples.');
    expect(el.textContent).not.toContain('Correct!');
  });

  it('emits solvedChange on correct check', () => {
    const solved: boolean[] = [];
    fixture.componentRef.setInput('question', {
      prompt: 'Pick one.',
      answer: 'B is right',
      choices: ['A is wrong', 'B is right', 'C is wrong'],
      explanation: 'B is the teaching point.',
    });
    fixture.detectChanges();
    component.solvedChange.subscribe((value) => solved.push(value));

    component.onChoiceChange('B is right');
    component.check();
    expect(solved).toEqual([true]);
  });

  it('shows explanation in readonly solved mode', () => {
    fixture.componentRef.setInput('solved', true);
    fixture.componentRef.setInput('readonly', true);
    fixture.componentRef.setInput('showExplanation', true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Why this answer');
    expect(el.textContent).toContain('Supervised learning uses labeled input–target pairs.');
    expect(el.querySelector('button')).toBeNull();
  });
});
