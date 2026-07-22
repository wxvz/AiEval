import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnLessonSessionService } from './learn-lesson-session.service';

describe('LearnLessonSessionService', () => {
  let service: LearnLessonSessionService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LearnLessonSessionService);
  });

  it('initializes and persists section solved state', () => {
    const state = service.init('learning-from-examples', 3, 2);
    expect(state.sectionsSolved).toEqual([false, false, false]);
    expect(state.recapSolved).toEqual([false, false]);

    service.setSectionSolved('learning-from-examples', 0, true, true);
    const restored = service.read('learning-from-examples');
    expect(restored?.sectionsSolved[0]).toBe(true);
    expect(restored?.collapsed[0]).toBe(true);
  });

  it('reports all solved when sections and recap are complete', () => {
    const state = service.init('train-vs-test', 2, 2);
    state.sectionsSolved = [true, true];
    state.recapSolved = [true, true];
    expect(service.allSolved(state)).toBe(true);
  });

  it('clears session for a lesson', () => {
    service.init('learning-from-examples', 1, 2);
    service.clear('learning-from-examples');
    expect(service.read('learning-from-examples')).toBeNull();
  });
});
