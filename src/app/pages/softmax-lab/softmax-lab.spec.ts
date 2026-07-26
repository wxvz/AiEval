import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { SoftmaxLabPage } from './softmax-lab';

describe('SoftmaxLabPage', () => {
  let fixture: ComponentFixture<SoftmaxLabPage>;
  let page: SoftmaxLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SoftmaxLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(SoftmaxLabPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders score controls', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Softmax');
    expect(el.querySelectorAll('input[type="range"]').length).toBe(3);
  });

  it('disables mark complete until Dog is the winning class', () => {
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['softmax-and-distributions']));
    const unlocked = TestBed.createComponent(SoftmaxLabPage);
    const unlockedPage = unlocked.componentInstance;
    unlocked.detectChanges();

    const button = unlocked.nativeElement.querySelector(
      'app-learn-lab-nav button',
    ) as HTMLButtonElement;
    expect(unlockedPage.solved()).toBe(false);
    expect(button.disabled).toBe(true);

    unlockedPage.markLabComplete();
    expect(unlockedPage.labCompleted()).toBe(false);

    // Raise Dog above Cat/Bird so Dog wins with share >= 0.45.
    unlockedPage.setScore(0, -1);
    unlockedPage.setScore(1, 2.5);
    unlockedPage.setScore(2, -1);
    unlocked.detectChanges();

    expect(unlockedPage.solved()).toBe(true);
    expect(button.disabled).toBe(false);
    unlockedPage.markLabComplete();
    expect(unlockedPage.labCompleted()).toBe(true);
  });
});
