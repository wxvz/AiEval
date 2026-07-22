import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { SemanticMemoryLabPage } from './semantic-memory-lab';

describe('SemanticMemoryLabPage', () => {
  let fixture: ComponentFixture<SemanticMemoryLabPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SemanticMemoryLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(SemanticMemoryLabPage);
    fixture.detectChanges();
  });

  it('renders ranked results for the default preset query', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Semantic memory practice');
    expect(el.textContent).toContain('Optional lab');
    expect(el.querySelector('table tbody tr')).toBeTruthy();
  });

  it('links back to parent read lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/semantic-memory"]',
    );
    expect(link).toBeTruthy();
  });
});
