import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearningRateLabPage } from './learning-rate-lab';

describe('LearningRateLabPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LearningRateLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders rate choices', () => {
    const fixture = TestBed.createComponent(LearningRateLabPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Learning rate');
    expect(el.textContent).toContain('medium');
  });
});
