import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { RagPlaygroundPage } from './rag-playground';

describe('RagPlaygroundPage', () => {
  let fixture: ComponentFixture<RagPlaygroundPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RagPlaygroundPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(RagPlaygroundPage);
    fixture.detectChanges();
  });

  it('renders retrieve and stub answer sections', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('RAG playground');
    expect(el.textContent).toContain('1. Retrieve');
    expect(el.textContent).toContain('4. Stub answer');
    expect(el.textContent).toContain('Based on the retrieved context');
  });

  it('renders pipeline diagram and common questions', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.learn-lab-diagram')).toBeTruthy();
    expect(el.querySelector('.learn-lab-plot')).toBeTruthy();
    expect(el.textContent).toContain('Context budget');
    expect(el.textContent).toContain('Common questions');
    expect(el.querySelector('.learn-lab-faq')).toBeTruthy();
  });

  it('shows prompt preview when chunks are selected', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.rag-prompt-preview')?.textContent).toContain('User:');
  });

  it('shows mark lab complete button', () => {
    const button: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      'app-learn-lab-nav button',
    );
    expect(button?.textContent?.trim()).toBe('Mark lab complete');
    expect(button?.disabled).toBe(false);
  });
});
