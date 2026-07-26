import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearningFromExamplesLabPage } from './learning-from-examples-lab';

describe('LearningFromExamplesLabPage', () => {
  let fixture: ComponentFixture<LearningFromExamplesLabPage>;
  let component: LearningFromExamplesLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LearningFromExamplesLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LearningFromExamplesLabPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders lab shell with parent lesson link', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Learning from examples lab');
    expect(el.textContent).toContain('Optional lab');
    expect(el.querySelector('a[href="/learn/lessons/learning-from-examples"]')).toBeTruthy();
  });

  it('grades matches after all inputs are paired', () => {
    for (const example of component.examples) {
      component.selectInput(example.id);
      component.assignTarget(example.id);
    }
    expect(component.allMatched()).toBe(true);

    component.check();
    expect(component.checked()).toBe(true);
    expect(component.correctCount()).toBe(component.examples.length);
  });

  it('prevents reusing an already matched target', () => {
    component.selectInput('ticket');
    component.assignTarget('photo');
    component.selectInput('review');
    component.assignTarget('photo');
    expect(component.matches()).toEqual({ ticket: 'photo' });
  });

  it('disables mark complete until all pairs are correct', () => {
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['learning-from-examples']));
    const unlocked = TestBed.createComponent(LearningFromExamplesLabPage);
    const unlockedPage = unlocked.componentInstance;
    unlocked.detectChanges();

    const button = unlocked.nativeElement.querySelector(
      'app-learn-lab-nav button',
    ) as HTMLButtonElement;
    expect(unlockedPage.solved()).toBe(false);
    expect(button.disabled).toBe(true);
    unlockedPage.markLabComplete();
    expect(unlockedPage.labCompleted()).toBe(false);

    for (const example of unlockedPage.examples) {
      unlockedPage.selectInput(example.id);
      unlockedPage.assignTarget(example.id);
    }
    unlockedPage.check();
    unlocked.detectChanges();

    expect(unlockedPage.solved()).toBe(true);
    expect(button.disabled).toBe(false);
    unlockedPage.markLabComplete();
    expect(unlockedPage.labCompleted()).toBe(true);
  });
});

