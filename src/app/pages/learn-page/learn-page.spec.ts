import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnPage } from './learn-page';

describe('LearnPage', () => {
  let fixture: ComponentFixture<LearnPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LearnPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LearnPage);
    fixture.detectChanges();
  });

  it('uses the shell with Learn brand, sticky Continue and Dashboard navigation', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-page-shell')).toBeTruthy();
    expect(el.querySelector('[shellleft].learn-hub-rail')).toBeNull();
    expect(el.querySelector('[shellmain] .learn-hub-main-brand__title')?.textContent?.trim()).toBe(
      'Learn',
    );
    expect(el.querySelector('[shellmain] .page-header')).toBeNull();
    expect(el.querySelector('[shellmain] app-learn-roadmap')).toBeTruthy();
    expect(el.querySelector('[shellmain] .learn-more__list')).toBeTruthy();
    expect(el.querySelector('[shellmain] .learn-more__list a[href="/evaluations/new"]')).toBeTruthy();
    expect(el.querySelector('[shellmain] .learn-more__list')?.textContent).not.toContain(
      'Decision trees',
    );
    expect(el.querySelector('[shellright].learn-hub-nav a[href="/"]')).toBeTruthy();
    expect(el.querySelector('[shellright].learn-hub-nav a[href^="/learn/"]')?.textContent).toContain(
      'Continue',
    );
    expect(el.querySelector('.learn-hub-nav__continue--solid')).toBeTruthy();
    expect(el.querySelector('.learn-roadmap a')?.textContent ?? '').not.toContain('Continue');
    expect(el.querySelector('[shellmain] .btn-primary')?.textContent ?? '').not.toContain('Continue');
  });

  it('shows the next lesson title and summary above Continue', () => {
    const el: HTMLElement = fixture.nativeElement;
    const next = el.querySelector('.learn-hub-nav__next');
    expect(next?.textContent).toContain('Lesson');
    expect(next?.textContent).not.toContain('Up next');
    expect(next?.textContent).toContain('Learning from examples');
    expect(next?.textContent).toContain('Supervised learning');
    expect(el.querySelector('.learn-hub-nav__continue')?.textContent).toContain('Continue');
  });
});
