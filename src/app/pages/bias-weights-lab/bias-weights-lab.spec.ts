import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { BiasWeightsLabPage } from './bias-weights-lab';

describe('BiasWeightsLabPage', () => {
  let fixture: ComponentFixture<BiasWeightsLabPage>;
  let page: BiasWeightsLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [BiasWeightsLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(BiasWeightsLabPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title, sliders, and predictions table', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Bias and weights');
    expect(el.textContent).toContain('Optional lab');
    expect(el.querySelector('#biasLabWeight')).toBeTruthy();
    expect(el.querySelector('#biasLabBias')).toBeTruthy();
    expect(el.querySelector('table')).toBeTruthy();
  });

  it('links back to parent read lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/bias-and-weights"]',
    );
    expect(link).toBeTruthy();
  });

  it('shows success banner when solved', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Solved: every probe');
    page.applyTip();
    fixture.detectChanges();
    expect(page.solved()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Solved: every probe');
  });
});
