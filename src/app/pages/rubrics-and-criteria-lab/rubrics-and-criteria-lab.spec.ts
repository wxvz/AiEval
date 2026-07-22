import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { RubricsAndCriteriaLabPage } from './rubrics-and-criteria-lab';

describe('RubricsAndCriteriaLabPage', () => {
  let fixture: ComponentFixture<RubricsAndCriteriaLabPage>;
  let component: RubricsAndCriteriaLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [RubricsAndCriteriaLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(RubricsAndCriteriaLabPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders lab shell with parent lesson link', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Rubrics and criteria lab');
    expect(el.textContent).toContain('Optional lab');
    expect(el.querySelector('a[href="/learn/lessons/rubrics-and-criteria"]')).toBeTruthy();
  });

  it('counts scores within tolerance of the reference', () => {
    component.setScore('accuracy', 4); // ref 5, within ±1
    component.setScore('brevity', 1); // ref 3, outside ±1
    component.setScore('clarity', 4); // ref 4, exact
    expect(component.allScored()).toBe(true);

    component.check();
    expect(component.checked()).toBe(true);
    expect(component.agreementCount()).toBe(2);
    expect(component.isWithinTolerance('brevity')).toBe(false);
  });

  it('rescoring clears checked state', () => {
    component.setScore('accuracy', 5);
    component.setScore('brevity', 3);
    component.setScore('clarity', 4);
    component.check();
    expect(component.checked()).toBe(true);

    component.setScore('brevity', 2);
    expect(component.checked()).toBe(false);
  });
});
