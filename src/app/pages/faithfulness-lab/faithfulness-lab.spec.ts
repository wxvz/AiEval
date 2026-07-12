import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { FaithfulnessLabPage } from './faithfulness-lab';

describe('FaithfulnessLabPage', () => {
  let fixture: ComponentFixture<FaithfulnessLabPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [FaithfulnessLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(FaithfulnessLabPage);
    fixture.detectChanges();
  });

  it('renders faithfulness lab shell', () => {
    expect(fixture.nativeElement.textContent).toContain('Faithfulness lab');
  });
});
