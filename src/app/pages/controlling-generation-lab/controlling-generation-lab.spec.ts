import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { ControllingGenerationLabPage } from './controlling-generation-lab';

describe('ControllingGenerationLabPage', () => {
  let fixture: ComponentFixture<ControllingGenerationLabPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ControllingGenerationLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ControllingGenerationLabPage);
    fixture.detectChanges();
  });

  it('renders generation variance lab shell', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Generation variance lab');
    expect(el.textContent).toContain('Optional lab');
  });

  it('links back to parent read lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/controlling-generation"]',
    );
    expect(link).toBeTruthy();
  });
});
