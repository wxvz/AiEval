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
});
