import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { SettingsService } from '../../services/settings.service';
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

  it('opens locked read lessons when unlock all is enabled', () => {
    settings.setLearnUnlockAll(true);
    fixture.detectChanges();

    const rows = fixture.componentInstance.lessonRows();
    const comparing = rows.find((row) => row.lesson.id === 'comparing-answers');
    expect(comparing?.route).toBe('/learn/lessons/comparing-answers');
    expect(comparing?.prereqLabel).toBeNull();
  });

  it('always exposes lab routes', () => {
    const rows = fixture.componentInstance.lessonRows();
    const semanticSearch = rows.find((row) => row.lesson.id === 'semantic-search-lab');
    expect(semanticSearch?.route).toBe('/learn/labs/semantic-search');
  });
});
