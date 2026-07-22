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

  it('uses the full-width shell with sticky Continue and Dashboard navigation', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-page-shell')).toBeTruthy();
    expect(el.querySelector('[shellleft]')).toBeFalsy();
    expect(el.querySelector('[shellmain] app-learn-roadmap')).toBeTruthy();
    expect(el.querySelector('[shellright].learn-hub-nav a[href="/"]')).toBeTruthy();
    expect(el.querySelector('[shellright].learn-hub-nav a[href^="/learn/"]')?.textContent).toContain(
      'Continue',
    );
  });
});
