import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { ComparingAnswersLabPage } from './comparing-answers-lab';

describe('ComparingAnswersLabPage', () => {
  let fixture: ComponentFixture<ComparingAnswersLabPage>;
  let component: ComparingAnswersLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ComparingAnswersLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ComparingAnswersLabPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders lab shell with parent lesson link', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Comparing answers lab');
    expect(el.textContent).toContain('Optional lab');
    expect(el.querySelector('a[href="/learn/lessons/comparing-answers"]')).toBeTruthy();
  });

  it('compares picks against reference verdicts', () => {
    for (const criterion of component.criteria) {
      component.pick(criterion.id, 'a');
    }
    expect(component.allPicked()).toBe(true);

    component.check();
    expect(component.checked()).toBe(true);
    expect(component.agreementCount()).toBe(component.criteria.length);
  });

  it('changing a pick clears checked state', () => {
    for (const criterion of component.criteria) {
      component.pick(criterion.id, 'a');
    }
    component.check();
    expect(component.checked()).toBe(true);

    component.pick(component.criteria[0]!.id, 'b');
    expect(component.checked()).toBe(false);
    expect(component.agreementCount()).toBe(component.criteria.length - 1);
  });
});
