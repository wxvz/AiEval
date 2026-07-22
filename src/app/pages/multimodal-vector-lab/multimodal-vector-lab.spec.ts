import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { MultimodalVectorLabPage } from './multimodal-vector-lab';

describe('MultimodalVectorLabPage', () => {
  let fixture: ComponentFixture<MultimodalVectorLabPage>;
  let page: MultimodalVectorLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [MultimodalVectorLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(MultimodalVectorLabPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the optional lab shell and ranked catalog', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Multimodal vector databases');
    expect(el.textContent).toContain('Optional lab');
    expect(el.querySelector('table tbody tr')).toBeTruthy();
  });

  it('links back to the parent read lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/multimodal-vector-databases"]',
    );
    expect(link).toBeTruthy();
  });

  it('marks the challenge solved after authorized waterproof filters', () => {
    expect(page.solved()).toBe(false);
    page.setTenantFilter('shop-a');
    page.setWaterproofOnly(true);
    fixture.detectChanges();
    expect(page.solved()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Solved');
  });
});
