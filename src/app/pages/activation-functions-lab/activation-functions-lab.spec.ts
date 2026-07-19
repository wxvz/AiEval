import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { ActivationFunctionsLabPage } from './activation-functions-lab';

describe('ActivationFunctionsLabPage', () => {
  let fixture: ComponentFixture<ActivationFunctionsLabPage>;
  let page: ActivationFunctionsLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ActivationFunctionsLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ActivationFunctionsLabPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title, activation buttons, and probes table', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Activation functions');
    expect(el.textContent).toContain('Optional lab');
    expect(el.textContent).toContain('ReLU');
    expect(el.querySelector('table')).toBeTruthy();
  });

  it('links back to parent read lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/activation-functions"]',
    );
    expect(link).toBeTruthy();
  });

  it('shows success banner when ReLU is selected', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Solved: that shape is ReLU');
    page.selectActivation('relu');
    fixture.detectChanges();
    expect(page.solved()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Solved: that shape is ReLU');
  });
});
