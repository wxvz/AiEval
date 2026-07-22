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
      answer: 'learning from labeled examples',
      wordBank: ['learning', 'from', 'labeled', 'examples', 'random', 'weights'],
      explanation: 'Supervised learning uses labeled input-target pairs.',
    });
    fixture.detectChanges();
  });

  function chipIndex(word: string): number {
    return component.question().wordBank!.indexOf(word);
  }

  it('shows success when the assembled words match the answer', () => {
    for (const word of ['learning', 'from', 'labeled', 'examples']) {
      component.addChip(chipIndex(word));
    }
    component.check();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Correct!');
    expect(el.textContent).not.toContain('Why this answer');
  });

  it('highlights placement instead of revealing the answer on incorrect assembly', () => {
    component.addChip(chipIndex('learning'));
    component.addChip(chipIndex('examples'));
    component.addChip(chipIndex('random'));
    component.check();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Not quite');
    expect(el.textContent).not.toContain('learning from labeled examples');
    expect(el.textContent).not.toContain('Correct!');
    expect(component.wordFeedback()).toEqual(['correct', 'wrong-place', 'absent']);

    const chips = el.querySelectorAll('.learn-check-question__chip--assembled');
    expect(chips[0]?.classList.contains('learn-check-question__chip--correct')).toBe(true);
    expect(chips[1]?.classList.contains('learn-check-question__chip--wrong-place')).toBe(true);
    expect(chips[2]?.classList.contains('learn-check-question__chip--absent')).toBe(true);
  });

  it('still reveals the answer card for incorrect multiple-choice', () => {
    fixture.componentRef.setInput('question', {
      prompt: 'Pick one.',
      answer: 'B is right',
      choices: ['A is wrong', 'B is right', 'C is wrong'],
      explanation: 'B is the teaching point.',
    });
    fixture.detectChanges();

    component.onChoiceChange('A is wrong');
    component.check();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Answer');
    expect(el.textContent).toContain('B is right');
  });

  it('returns a chip to the bank when the assembled word is tapped', () => {
    component.addChip(chipIndex('learning'));
    component.addChip(chipIndex('from'));
    expect(component.assembledText()).toBe('learning from');

    component.removeAssembled(0);
    expect(component.assembledText()).toBe('from');
    expect(component.isChipUsed(chipIndex('learning'))).toBe(false);
  });

  it('does not reuse a chip already in the assembled answer', () => {
    component.addChip(chipIndex('learning'));
    component.addChip(chipIndex('learning'));
    expect(component.assembledText()).toBe('learning');
  });

  it('clears the assembled answer', () => {
    component.addChip(chipIndex('learning'));
    component.clearAssembled();
    expect(component.assembledIndices()).toEqual([]);
  });

  it('emits solvedChange on correct multiple-choice check', () => {
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

  it('shows canonical answer and explanation in readonly solved mode', () => {
    fixture.componentRef.setInput('solved', true);
    fixture.componentRef.setInput('readonly', true);
    fixture.componentRef.setInput('showExplanation', true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Your answer:');
    expect(el.textContent).toContain('learning from labeled examples');
    expect(el.textContent).toContain('Why this answer');
    expect(el.querySelector('.learn-check-question__bank')).toBeNull();
  });

  it('clears prior answer UI when the question changes and solved is false', () => {
    for (const word of ['learning', 'from', 'labeled', 'examples']) {
      component.addChip(chipIndex(word));
    }
    component.check();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Correct!');

    fixture.componentRef.setInput('solved', false);
    fixture.componentRef.setInput('question', {
      prompt: 'What is unsupervised learning?',
      answer: 'learning from unlabeled data',
      wordBank: ['learning', 'from', 'unlabeled', 'data', 'labels'],
      explanation: 'No labels are provided.',
    });
    fixture.detectChanges();

    expect(component.selectedChoice()).toBe('');
    expect(component.assembledIndices()).toEqual([]);
    expect(component.checked()).toBe(false);
    expect(component.isCorrect()).toBeNull();
    expect(component.wordFeedback()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Correct!');
  });
});
