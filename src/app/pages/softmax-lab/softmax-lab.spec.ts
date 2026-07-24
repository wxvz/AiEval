import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { SoftmaxLabPage } from './softmax-lab';

describe('SoftmaxLabPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SoftmaxLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders score controls', () => {
    const fixture = TestBed.createComponent(SoftmaxLabPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Softmax');
    expect(el.querySelectorAll('input[type="range"]').length).toBe(3);
  });
});
