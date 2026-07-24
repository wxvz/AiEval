import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { SemanticSearchLabPage } from './semantic-search-lab';

describe('SemanticSearchLabPage', () => {
  let fixture: ComponentFixture<SemanticSearchLabPage>;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['semantic-memory']));
    await TestBed.configureTestingModule({
      imports: [SemanticSearchLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(SemanticSearchLabPage);
    fixture.detectChanges();
  });

  it('renders ranked results for default query', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Semantic search');
    expect(el.textContent).toContain('rubric');
    expect(el.querySelector('.learn-lab-plot')).toBeTruthy();
  });

  it('renders common questions and prereq link', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Common questions');
    expect(el.querySelector('.learn-lab-faq')).toBeTruthy();
    const prereqLink: HTMLAnchorElement | null = el.querySelector('a[href="/learn/lessons/semantic-memory"]');
    expect(prereqLink?.textContent).toContain('Semantic memory');
  });

  it('shows mark lab complete button', () => {
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'app-learn-lab-nav button',
    );
    expect(button?.textContent?.trim()).toBe('Mark lab complete');
    expect(button?.disabled).toBe(false);
  });

  it('links back to the parent lesson from sticky nav', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'app-learn-lab-nav a[href="/learn/lessons/semantic-memory"]',
    );
    expect(link?.getAttribute('href')).toBe('/learn/lessons/semantic-memory');
  });
});
