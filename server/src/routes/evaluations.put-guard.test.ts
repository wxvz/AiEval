import { describe, expect, it } from 'vitest';

import {
  isEvaluationAutomationActive,
  wouldOverwriteAutomationOwnedFields,
} from './evaluations.js';
import {
  clearAutomationRun,
  registerAutomationRun,
} from '../automation/run-registry.js';

describe('wouldOverwriteAutomationOwnedFields', () => {
  const existing = {
    answers: [
      {
        id: 'a1',
        evaluationId: 'e1',
        label: 'Model A',
        content: 'Answer A',
        scores: [],
      },
    ],
    winnerAnswerId: 'a1',
    improvedAnswer: { finalAnswer: 'Improved' },
  };

  it('returns false when protected fields are omitted', () => {
    expect(wouldOverwriteAutomationOwnedFields({ title: 'New title' }, existing)).toBe(false);
  });

  it('returns false when protected fields match existing', () => {
    expect(
      wouldOverwriteAutomationOwnedFields(
        {
          answers: existing.answers,
          winnerAnswerId: existing.winnerAnswerId,
          improvedAnswer: existing.improvedAnswer,
        },
        existing,
      ),
    ).toBe(false);
  });

  it('returns true when answers would change', () => {
    expect(
      wouldOverwriteAutomationOwnedFields(
        {
          answers: [
            {
              id: 'a1',
              evaluationId: 'e1',
              label: 'Model A',
              content: 'Stale answer',
              scores: [],
            },
          ],
        },
        existing,
      ),
    ).toBe(true);
  });

  it('returns true when winnerAnswerId would change', () => {
    expect(wouldOverwriteAutomationOwnedFields({ winnerAnswerId: 'other' }, existing)).toBe(true);
  });

  it('returns true when improvedAnswer would change', () => {
    expect(
      wouldOverwriteAutomationOwnedFields({ improvedAnswer: { finalAnswer: 'Other' } }, existing),
    ).toBe(true);
  });

  it('returns true when improvedAnswer would be cleared', () => {
    expect(wouldOverwriteAutomationOwnedFields({ improvedAnswer: undefined }, existing)).toBe(
      true,
    );
  });
});

describe('isEvaluationAutomationActive', () => {
  const evaluationId = '507f1f77bcf86cd799439011';

  it('is false when no run is registered', () => {
    expect(isEvaluationAutomationActive(evaluationId)).toBe(false);
  });

  it('is true when a run is registered', () => {
    const signal = registerAutomationRun(evaluationId, 'run-match');
    expect(signal.aborted).toBe(false);
    expect(isEvaluationAutomationActive(evaluationId)).toBe(true);
    clearAutomationRun(evaluationId, 'run-match');
  });

  it('is false after the active run is cleared', () => {
    registerAutomationRun(evaluationId, 'run-cleared');
    clearAutomationRun(evaluationId, 'run-cleared');
    expect(isEvaluationAutomationActive(evaluationId)).toBe(false);
  });
});
