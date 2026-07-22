import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { WhatIsADatasetLabPage } from './what-is-a-dataset-lab';

describe('WhatIsADatasetLabPage', () => {
  let fixture: ComponentFixture<WhatIsADatasetLabPage>;
  let component: WhatIsADatasetLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [WhatIsADatasetLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(WhatIsADatasetLabPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders lab shell with parent lesson link', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Build the XOR dataset');
    expect(el.textContent).toContain('Optional lab');
    expect(el.querySelector('a[href="/learn/lessons/what-is-a-dataset"]')).toBeTruthy();
  });

  it('grades corner labels against XOR', () => {
    component.setLabel(0, 0);
    component.setLabel(1, 1);
    component.setLabel(2, 1);
    component.setLabel(3, 1);
    expect(component.allLabeled()).toBe(true);

    component.check();
    expect(component.checked()).toBe(true);
    expect(component.correctCount()).toBe(3);
    expect(component.isCorrect(3)).toBe(false);
  });

  it('relabeling clears the checked state', () => {
    component.setLabel(0, 0);
    component.setLabel(1, 1);
    component.setLabel(2, 1);
    component.setLabel(3, 0);
    component.check();
    expect(component.checked()).toBe(true);

    component.setLabel(3, 1);
    expect(component.checked()).toBe(false);
  });
});
