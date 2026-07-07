import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnProgressService } from './learn-progress.service';

describe('LearnProgressService', () => {
  let service: LearnProgressService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LearnProgressService);
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

  it('disables mark complete for read lessons without content', () => {
    expect(service.canMarkComplete({ id: 'loss-and-updates', kind: 'read' } as never)).toBe(
      false,
    );
  });

  it('allows mark complete for interactive labs', () => {
    expect(service.canMarkComplete({ id: 'neural-network-lab', kind: 'interactive' } as never)).toBe(
      true,
    );
  });
});
