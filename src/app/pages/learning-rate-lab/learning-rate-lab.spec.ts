import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearningRateLabPage } from './learning-rate-lab';

describe('LearningRateLabPage', () => {
  let fixture: ComponentFixture<LearningRateLabPage>;
  let page: LearningRateLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LearningRateLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LearningRateLabPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders rate choices', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Learning rate');
    expect(el.textContent).toContain('medium');
  });

  it('does not show pattern confirmed until medium and huge are inspected', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).not.toContain('Pattern confirmed');
    expect(page.solved()).toBe(false);

    page.selectRate('medium');
    fixture.detectChanges();
    expect(page.solved()).toBe(false);
    expect(el.textContent).not.toContain('Pattern confirmed');

    page.selectRate('huge');
    fixture.detectChanges();
    expect(page.solved()).toBe(true);
    expect(el.textContent).toContain('Pattern confirmed');
  });

  it('disables mark complete until the comparison pattern is confirmed', () => {
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['learning-rate']));
    const unlocked = TestBed.createComponent(LearningRateLabPage);
    const unlockedPage = unlocked.componentInstance;
    unlocked.detectChanges();

    const button = unlocked.nativeElement.querySelector(
      'app-learn-lab-nav button',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    unlockedPage.markLabComplete();
    expect(unlockedPage.labCompleted()).toBe(false);

    unlockedPage.selectRate('medium');
    unlockedPage.selectRate('huge');
    unlocked.detectChanges();

    expect(button.disabled).toBe(false);
    unlockedPage.markLabComplete();
    expect(unlockedPage.labCompleted()).toBe(true);
  });
});
