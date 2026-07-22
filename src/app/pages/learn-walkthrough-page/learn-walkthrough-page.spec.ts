import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnWalkthroughPage } from './learn-walkthrough-page';

describe('LearnWalkthroughPage', () => {
  let fixture: ComponentFixture<LearnWalkthroughPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LearnWalkthroughPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LearnWalkthroughPage);
    fixture.detectChanges();
  });

  it('renders walkthrough steps from JSON', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Open the create page');
    expect(el.textContent).toContain('Create evaluation');
    expect(el.querySelector('.learn-walkthrough-step')).toBeTruthy();
  });

  it('shows dynamic track label and flow diagram', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('LLM systems');
    expect(el.querySelector('.learn-lab-diagram')).toBeTruthy();
  });

  it('renders common questions and prereq link', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Common questions');
    expect(el.querySelector('.learn-lab-faq')).toBeTruthy();
    const prereqLink: HTMLAnchorElement | null = el.querySelector('a[href="/learn/labs/rag-playground"]');
    expect(prereqLink?.textContent).toContain('RAG playground');
  });

  it('enables mark lab complete when steps exist', () => {
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector('app-learn-lab-nav button');
    expect(button?.textContent?.trim()).toBe('Mark lab complete');
    expect(button?.disabled).toBe(false);
  });

  it('splits actionRoute query params for create and dashboard links', () => {
    const el: HTMLElement = fixture.nativeElement;
    const createLink = el.querySelector(
      'a[href="/evaluations/new?from=learn"]',
    ) as HTMLAnchorElement | null;
    const dashboardLink = el.querySelector('a[href="/?from=learn"]') as HTMLAnchorElement | null;

    expect(createLink).toBeTruthy();
    expect(dashboardLink).toBeTruthy();
    expect(el.querySelector('a[href*="%3Ffrom"]')).toBeNull();
    expect(fixture.componentInstance.actionPath('/evaluations/new?from=learn')).toBe(
      '/evaluations/new',
    );
    expect(fixture.componentInstance.actionQueryParams('/evaluations/new?from=learn')).toEqual({
      from: 'learn',
    });
    expect(fixture.componentInstance.actionQueryParams('/?from=learn')).toEqual({ from: 'learn' });
  });
});
