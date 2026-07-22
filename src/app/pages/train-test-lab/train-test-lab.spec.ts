import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { TrainTestLabPage } from './train-test-lab';

describe('TrainTestLabPage', () => {
  let fixture: ComponentFixture<TrainTestLabPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TrainTestLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TrainTestLabPage);
    fixture.detectChanges();
  });

  it('renders map, table, and split controls', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Train vs test');
    expect(el.querySelector('.learn-lab-plot')).toBeTruthy();
    expect(el.querySelector('table')).toBeTruthy();
    expect(el.querySelector('.learn-lab-diagram')).toBeTruthy();
  });

  it('links back to parent read lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/train-vs-test"]',
    );
    expect(link).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Optional lab');
  });

  it('shows mark lab complete button', () => {
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'app-learn-lab-nav button',
    );
    expect(button?.textContent?.trim()).toBe('Mark lab complete');
    expect(button?.disabled).toBe(false);
  });

  it('uses parent-aware navigation for the optional lab', () => {
    const nav: HTMLElement | null = fixture.nativeElement.querySelector('app-learn-lab-nav');
    expect(nav?.querySelector('a[href="/learn/lessons/train-vs-test"]')).toBeTruthy();
    expect(nav?.querySelector('a[href="/learn/lessons/loss-and-updates"]')).toBeTruthy();
  });
});
