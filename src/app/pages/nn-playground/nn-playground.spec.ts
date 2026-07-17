import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { NnPlaygroundPage } from './nn-playground';

describe('NnPlaygroundPage', () => {
  let fixture: ComponentFixture<NnPlaygroundPage>;
  let page: NnPlaygroundPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [NnPlaygroundPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(NnPlaygroundPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('switches to softmax when selecting the three-class dataset', () => {
    page.outputActivation.set('sigmoid');
    page.onDatasetChange('three-class');
    expect(page.outputActivation()).toBe('softmax');
    expect(page.datasetName()).toBe('three-class');
    expect(page.outputSize()).toBe(3);
  });

  it('switches away from softmax when selecting XOR or AND', () => {
    page.outputActivation.set('softmax');
    page.onDatasetChange('xor');
    expect(page.outputActivation()).toBe('sigmoid');
    expect(page.datasetName()).toBe('xor');
    expect(page.outputSize()).toBe(1);

    page.outputActivation.set('softmax');
    page.onDatasetChange('and');
    expect(page.outputActivation()).toBe('sigmoid');
    expect(page.datasetName()).toBe('and');
  });

  it('uses x2 values for the custom plot domain vertical axis', () => {
    page.datasetName.set('custom');
    page.customSamples.set([
      { x1: 0, x2: 10, y: 0 },
      { x1: 1, x2: 20, y: 1 },
    ]);
    const domain = page.plotDomain();
    expect(domain.minY).toBeLessThan(10);
    expect(domain.maxY).toBeGreaterThan(20);
    expect(domain.minX).toBeLessThan(0);
    expect(domain.maxX).toBeGreaterThan(1);
  });
});
