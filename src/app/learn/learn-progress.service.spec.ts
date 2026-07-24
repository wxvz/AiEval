import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnHandoffService } from './learn-handoff.service';
import { LearnProgressService } from './learn-progress.service';
import { SettingsService } from '../services/settings.service';

describe('LearnProgressService', () => {
  let service: LearnProgressService;
  let settings: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LearnProgressService);
    settings = TestBed.inject(SettingsService);
    settings.setLearnUnlockAll(false);
  });

  it('marks a known lesson complete and persists', () => {
    service.markComplete('learning-from-examples');
    expect(service.isComplete('learning-from-examples')).toBe(true);
    expect(JSON.parse(localStorage.getItem('aieval-learn-progress')!)).toContain(
      'learning-from-examples',
    );
  });

  it('ignores unknown lesson ids when reading storage', () => {
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['deleted-lesson', 'train-vs-test']));
    expect([...service.completedIds()]).toEqual(['train-vs-test']);
  });

  it('does not persist unknown lesson ids on markComplete', () => {
    service.markComplete('not-a-lesson');
    expect(service.completedIds().size).toBe(0);
  });

  it('does not mark a locked lab complete until prerequisites are met', () => {
    service.markComplete('learning-rate-lab');
    expect(service.isComplete('learning-rate-lab')).toBe(false);

    localStorage.setItem('aieval-learn-progress', JSON.stringify(['learning-rate']));
    service.markComplete('learning-rate-lab');
    expect(service.isComplete('learning-rate-lab')).toBe(true);
  });

  it('allows marking a locked lab complete when unlock-all is enabled', () => {
    settings.setLearnUnlockAll(true);
    service.markComplete('learning-rate-lab');
    expect(service.isComplete('learning-rate-lab')).toBe(true);
  });

  it('disables mark complete for read lessons without content', () => {
    expect(service.canMarkComplete({ id: 'lesson-without-body', kind: 'read' } as never)).toBe(
      false,
    );
  });

  it('allows mark complete for interactive labs', () => {
    expect(service.canMarkComplete({ id: 'neural-network-lab', kind: 'interactive' } as never)).toBe(
      true,
    );
  });

  it('requires a handoff evaluation before marking a tool walkthrough complete', () => {
    const handoff = TestBed.inject(LearnHandoffService);
    const tool = {
      id: 'first-evaluation-lab',
      kind: 'tool',
    } as never;
    expect(service.canMarkComplete(tool)).toBe(false);
    handoff.recordEvaluation('eval-1', 'first-evaluation-lab');
    expect(service.canMarkComplete(tool)).toBe(true);
  });
});
