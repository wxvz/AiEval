import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnHandoffService } from './learn-handoff.service';

describe('LearnHandoffService', () => {
  let service: LearnHandoffService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LearnHandoffService);
  });

  it('records evaluation id and lesson id in sessionStorage', () => {
    service.recordEvaluation('eval-1', 'first-evaluation-lab');
    expect(service.highlightedEvaluationId()).toBe('eval-1');
    expect(service.lessonId()).toBe('first-evaluation-lab');
    expect(service.showDashboardBanner()).toBe(true);
  });

  it('dismisses dashboard banner without clearing highlight', () => {
    service.recordEvaluation('eval-1');
    service.dismissBanner();
    expect(service.showDashboardBanner()).toBe(false);
    expect(service.highlightedEvaluationId()).toBe('eval-1');
  });

  it('clears handoff state', () => {
    service.recordEvaluation('eval-1');
    service.clear();
    expect(service.highlightedEvaluationId()).toBeNull();
    expect(service.showDashboardBanner()).toBe(false);
  });

  it('recognizes learn query param', () => {
    expect(service.isLearnContext('learn')).toBe(true);
    expect(service.isLearnContext('other')).toBe(false);
    expect(service.isLearnContext(null)).toBe(false);
  });

  it('resets banner dismissed when recording a different evaluation', () => {
    service.recordEvaluation('eval-1');
    service.dismissBanner();
    service.recordEvaluation('eval-2');
    expect(service.showDashboardBanner()).toBe(true);
    expect(service.highlightedEvaluationId()).toBe('eval-2');
  });
});
