import { describe, expect, it } from 'vitest';

import { Evaluation } from '../../models';
import { canRunAutomationPhase } from './automation-controls';

const baseEvaluation = (): Evaluation => ({
  id: 'eval-1',
  title: 'Test',
  prompt: 'Say hello',
  criteriaMode: 'default',
  criteria: [],
  answers: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('canRunAutomationPhase', () => {
  it('requires prompt and criteria for generate', () => {
    expect(canRunAutomationPhase(undefined, 'generate')).toBe(false);
    expect(canRunAutomationPhase({ ...baseEvaluation(), prompt: '  ' }, 'generate')).toBe(false);
    expect(canRunAutomationPhase(baseEvaluation(), 'generate')).toBe(true);
  });

  it('requires answers and criteria for score', () => {
    expect(canRunAutomationPhase(baseEvaluation(), 'score')).toBe(false);
    expect(
      canRunAutomationPhase(
        {
          ...baseEvaluation(),
          answers: [
            {
              id: 'a1',
              evaluationId: 'eval-1',
              label: 'M1',
              content: 'Hi',
              scores: [],
            },
          ],
        },
        'score',
      ),
    ).toBe(true);
  });

  it('requires a winner for improved', () => {
    expect(canRunAutomationPhase(baseEvaluation(), 'improved')).toBe(false);
    expect(
      canRunAutomationPhase({ ...baseEvaluation(), winnerAnswerId: 'a1' }, 'improved'),
    ).toBe(true);
  });
});
