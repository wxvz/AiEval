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
    expect(service.hasHandoffForLesson('first-evaluation-lab')).toBe(true);
  });

  it('keeps prior lesson entries when recording a second lab', () => {
    service.recordEvaluation('eval-1', 'first-evaluation-lab');
    service.recordEvaluation('eval-2', 'support-bot-decision-lab');
    expect(service.highlightedEvaluationId()).toBe('eval-2');
    expect(service.lessonId()).toBe('support-bot-decision-lab');
    expect(service.lessonIdForEvaluation('eval-1')).toBe('first-evaluation-lab');
    expect(service.lessonIdForEvaluation('eval-2')).toBe('support-bot-decision-lab');
  });

  it('replaces only the same lesson entry on re-run', () => {
    service.recordEvaluation('eval-1', 'first-evaluation-lab');
    service.recordEvaluation('eval-1b', 'first-evaluation-lab');
    expect(service.evaluationIdForLesson('first-evaluation-lab')).toBe('eval-1b');
    expect(service.lessonIdForEvaluation('eval-1')).toBeNull();
  });

  it('activates a lesson that already has a handoff', () => {
    service.recordEvaluation('eval-1', 'first-evaluation-lab');
    service.recordEvaluation('eval-2', 'support-bot-decision-lab');
    service.activateLesson('first-evaluation-lab');
    expect(service.lessonId()).toBe('first-evaluation-lab');
    expect(service.highlightedEvaluationId()).toBe('eval-1');
  });

  it('dismisses dashboard banner without clearing highlight', () => {
    service.recordEvaluation('eval-1', 'first-evaluation-lab');
    service.dismissBanner();
    expect(service.showDashboardBanner()).toBe(false);
    expect(service.highlightedEvaluationId()).toBe('eval-1');
  });

  it('clears one lesson without wiping the other', () => {
    service.recordEvaluation('eval-1', 'first-evaluation-lab');
    service.recordEvaluation('eval-2', 'support-bot-decision-lab');
    service.clearLesson('support-bot-decision-lab');
    expect(service.hasHandoffForLesson('support-bot-decision-lab')).toBe(false);
    expect(service.hasHandoffForLesson('first-evaluation-lab')).toBe(true);
  });

  it('clears handoff state', () => {
    service.recordEvaluation('eval-1', 'first-evaluation-lab');
    service.clear();
    expect(service.highlightedEvaluationId()).toBeNull();
    expect(service.showDashboardBanner()).toBe(false);
  });

  it('recognizes learn query param', () => {
    expect(service.isLearnContext('learn')).toBe(true);
    expect(service.isLearnContext('other')).toBe(false);
    expect(service.isLearnContext(null)).toBe(false);
  });

  it('migrates legacy single-entry storage', () => {
    sessionStorage.setItem(
      'aieval-learn-handoff',
      JSON.stringify({
        evaluationId: 'legacy-eval',
        lessonId: 'first-evaluation-lab',
        bannerDismissed: false,
      }),
    );
    expect(service.highlightedEvaluationId()).toBe('legacy-eval');
    expect(service.lessonId()).toBe('first-evaluation-lab');
  });

  it('resets banner dismissed when recording a different evaluation for the active lesson', () => {
    service.recordEvaluation('eval-1', 'first-evaluation-lab');
    service.dismissBanner();
    service.recordEvaluation('eval-2', 'first-evaluation-lab');
    expect(service.showDashboardBanner()).toBe(true);
    expect(service.highlightedEvaluationId()).toBe('eval-2');
  });
});
