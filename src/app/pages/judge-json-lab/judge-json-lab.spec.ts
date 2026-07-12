import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { JudgeJsonLabPage } from './judge-json-lab';

describe('JudgeJsonLabPage', () => {
  let fixture: ComponentFixture<JudgeJsonLabPage>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [JudgeJsonLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(JudgeJsonLabPage);
    fixture.detectChanges();
  });

  it('renders judge JSON lab shell', () => {
    expect(fixture.nativeElement.textContent).toContain('Judge JSON lab');
  });
});
