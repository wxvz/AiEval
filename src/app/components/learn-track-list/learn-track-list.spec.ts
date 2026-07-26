import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { SettingsService } from '../../services/settings.service';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { LearnTrackList } from './learn-track-list';

describe('LearnTrackList', () => {
  let fixture: ComponentFixture<LearnTrackList>;
  let settings: SettingsService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LearnTrackList],
      providers: [provideRouter([])],
    }).compileComponents();
    settings = TestBed.inject(SettingsService);
    fixture = TestBed.createComponent(LearnTrackList);
    fixture.componentRef.setInput('trackId', 'llm-systems');
    fixture.detectChanges();
  });

  it('locks read lessons until prerequisites are complete', () => {
    const rows = fixture.componentInstance.lessonRows();
    const comparing = rows.find((row) => row.lesson.id === 'comparing-answers');
    expect(comparing?.route).toBeNull();
    expect(comparing?.prereqLabel).toBe('Controlling generation');
  });

  it('expands unlocked rows to show summary and locked rows to show unlock line only', () => {
    fixture.componentRef.setInput('trackId', 'foundation');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const firstRow = el.querySelector('.learn-track__row--next') as HTMLElement | null;
    expect(firstRow).toBeTruthy();
    expect(firstRow?.querySelector('.learn-track__lesson-summary')).toBeNull();

    firstRow?.click();
    fixture.detectChanges();
    expect(firstRow?.querySelector('.learn-track__lesson-summary')?.textContent).toContain(
      'Supervised learning',
    );
    expect(firstRow?.querySelector('a.learn-track__title-link[href="/learn/lessons/learning-from-examples"]')).toBeTruthy();

    const lockedRow = Array.from(el.querySelectorAll('.learn-track__row--locked')).find((row) =>
      row.textContent?.includes('What is a dataset'),
    ) as HTMLElement | undefined;
    expect(lockedRow).toBeTruthy();
    expect(lockedRow?.textContent).toContain('Locked');
    lockedRow?.click();
    fixture.detectChanges();
    expect(lockedRow?.querySelector('.learn-track__lesson-summary')).toBeNull();
    expect(lockedRow?.querySelector('.learn-track__prereq')?.textContent).toContain(
      'Complete Learning from examples first',
    );
  });

  it('renders branch spurs under spine parents when expanded', () => {
    fixture.componentRef.setInput('trackId', 'foundation');
    fixture.detectChanges();

    const dataLiteracy = fixture.componentInstance
      .lessonRows()
      .find((row) => row.lesson.id === 'data-literacy');
    expect(dataLiteracy?.spur.map((s) => s.lesson.id)).toEqual([
      'decision-trees',
      'decision-trees-lab',
    ]);

    const deepLearning = fixture.componentInstance
      .lessonRows()
      .find((row) => row.lesson.id === 'deep-learning-approaches');
    expect(deepLearning?.spur.map((s) => s.lesson.id)).toEqual([
      'reinforcement-learning',
      'reinforcement-learning-lab',
      'generative-adversarial-networks',
    ]);

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.learn-track__spur')).toBeNull();

    const dataLiteracyRow = Array.from(el.querySelectorAll('.learn-track__row')).find((row) =>
      row.textContent?.includes('Data literacy'),
    ) as HTMLElement | undefined;
    dataLiteracyRow?.click();
    fixture.detectChanges();

    expect(el.querySelector('.learn-track__spur')).toBeTruthy();
    expect(el.querySelector('.learn-track__spur')?.textContent).toContain('Decision trees');
    expect(el.querySelector('.learn-track__spur')?.textContent).not.toContain(
      'Reinforcement learning',
    );
  });

  it('opens locked read lessons when unlock all is enabled', () => {
    settings.setLearnUnlockAll(true);
    fixture.detectChanges();

    const rows = fixture.componentInstance.lessonRows();
    const comparing = rows.find((row) => row.lesson.id === 'comparing-answers');
    expect(comparing?.route).toBe('/learn/lessons/comparing-answers');
    expect(comparing?.prereqLabel).toBeNull();
  });

  it('locks branch spur labs until prerequisites are complete', () => {
    fixture.componentRef.setInput('trackId', 'llm-systems');
    fixture.detectChanges();
    const memory = fixture.componentInstance.lessonRows().find((row) => row.lesson.id === 'semantic-memory');
    const search = memory?.spur.find((s) => s.lesson.id === 'semantic-search-lab');
    expect(search?.route).toBeNull();
    expect(search?.prereqLabel).toBe('Semantic memory');
  });

  it('opens branch spur labs when prerequisites are complete', () => {
    // Seed the lab's parent prereq so markComplete is allowed under lock gating.
    localStorage.setItem(
      'aieval-learn-progress',
      JSON.stringify(['structured-outputs-for-judges']),
    );
    const progress = TestBed.inject(LearnProgressService);
    progress.markComplete('semantic-memory');
    fixture.componentRef.setInput('trackId', 'llm-systems');
    fixture.detectChanges();

    const memory = fixture.componentInstance.lessonRows().find((row) => row.lesson.id === 'semantic-memory');
    const search = memory?.spur.find((s) => s.lesson.id === 'semantic-search-lab');
    expect(search?.route).toBe('/learn/labs/semantic-search');
    expect(search?.prereqLabel).toBeNull();
  });

  it('opens the first lesson of each track without prior progress', () => {
    fixture.componentRef.setInput('trackId', 'llm-systems');
    fixture.detectChanges();
    const prompts = fixture.componentInstance.lessonRows().find((row) => row.lesson.id === 'prompts-as-instructions');
    expect(prompts?.route).toBe('/learn/lessons/prompts-as-instructions');
    expect(prompts?.prereqLabel).toBeNull();

    fixture.componentRef.setInput('trackId', 'systems-production');
    fixture.detectChanges();
    const production = fixture.componentInstance
      .lessonRows()
      .find((row) => row.lesson.id === 'production-concerns');
    expect(production?.route).toBe('/learn/lessons/production-concerns');
    expect(production?.prereqLabel).toBeNull();
  });

  it('marks the curriculum next lesson on the foundation track', async () => {
    fixture.componentRef.setInput('trackId', 'foundation');
    fixture.detectChanges();
    const rows = fixture.componentInstance.lessonRows();
    const nextRows = rows.filter((row) => row.isNext);
    expect(nextRows).toHaveLength(1);
    expect(nextRows[0]?.lesson.id).toBe('learning-from-examples');
    expect(nextRows[0]?.index).toBe(1);
    expect(fixture.nativeElement.querySelector('.learn-track__row--next')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.learn-track__header')?.textContent).toContain(
      'Foundation',
    );
  });
});
