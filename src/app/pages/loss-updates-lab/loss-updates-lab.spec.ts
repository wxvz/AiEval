import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LossUpdatesLabPage } from './loss-updates-lab';

describe('LossUpdatesLabPage', () => {
  let fixture: ComponentFixture<LossUpdatesLabPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LossUpdatesLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LossUpdatesLabPage);
    fixture.detectChanges();
  });

  it('renders loss plot area and predictions table', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Loss and updates');
    expect(el.textContent).toContain('Optional lab');
    expect(el.querySelector('table')).toBeTruthy();
  });

  it('links back to parent read lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/loss-and-updates"]',
    );
    expect(link).toBeTruthy();
  });
});
