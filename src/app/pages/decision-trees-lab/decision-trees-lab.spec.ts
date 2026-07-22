import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { DecisionTreesLabPage } from './decision-trees-lab';

describe('DecisionTreesLabPage', () => {
  let fixture: ComponentFixture<DecisionTreesLabPage>;
  let page: DecisionTreesLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [DecisionTreesLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(DecisionTreesLabPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title and training table', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Decision trees lab');
    expect(el.querySelector('table')).toBeTruthy();
    expect(el.textContent).toContain('Mentions refund?');
  });

  it('links back to the decision-trees read lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/decision-trees"]',
    );
    expect(link).toBeTruthy();
  });

  it('shows success when the refund split is labeled correctly', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Solved:');
    page.selectFeature('mentionsRefund');
    page.selectYesLabel('billing');
    page.selectNoLabel('access');
    fixture.detectChanges();
    expect(page.solved()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Solved:');
  });
});
