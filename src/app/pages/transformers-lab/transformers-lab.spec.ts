import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { HINT_ATTENTION_WEIGHTS } from '../../utils/transformers/attention';
import { TransformersLabPage } from './transformers-lab';

describe('TransformersLabPage', () => {
  let fixture: ComponentFixture<TransformersLabPage>;
  let page: TransformersLabPage;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['transformers-overview']));
    await TestBed.configureTestingModule({
      imports: [TransformersLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TransformersLabPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders lead, honesty callout, and attention sliders', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Transformers lab');
    expect(el.textContent).toContain('Optional lab');
    expect(el.textContent).toContain('Teaching shortcut');
    expect(el.querySelectorAll('input[type="range"]').length).toBe(4);
    expect(el.querySelector('.learn-lab-faq')).toBeTruthy();
  });

  it('links back to the transformers overview lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/transformers-overview"]',
    );
    expect(link).toBeTruthy();
  });

  it('shows success when target ranking is achieved', () => {
    page.rawWeights.set([...HINT_ATTENTION_WEIGHTS]);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Target ranking achieved');
    expect(page.result().success).toBe(true);
  });

  it('wires mark complete for transformers-lab after target ranking', () => {
    expect(page.labMeta?.id).toBe('transformers-lab');
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['transformers-overview']));
    page.markLabComplete();
    expect(page.labCompleted()).toBe(false);

    page.rawWeights.set([...HINT_ATTENTION_WEIGHTS]);
    page.markLabComplete();
    expect(page.labCompleted()).toBe(true);
  });
});
