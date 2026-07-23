import { describe, expect, it } from 'vitest';

import { DEFAULT_EVALUATION_CONFIG, Evaluation } from '../../models';
import { canRunAutomationPhase } from './automation-controls';

const SLOTS = 3;

const baseEvaluation = (): Evaluation => ({
  id: 'eval-1',
  title: 'Test',
  prompt: 'Say hello',
  criteriaMode: 'default',
  criteria: [],
  evaluationConfig: DEFAULT_EVALUATION_CONFIG,
  answers: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('canRunAutomationPhase', () => {
  it('requires prompt and criteria for generate', () => {
    expect(canRunAutomationPhase(undefined, 'generate', SLOTS)).toBe(false);
    expect(canRunAutomationPhase({ ...baseEvaluation(), prompt: '  ' }, 'generate', SLOTS)).toBe(
      false,
    );
    expect(canRunAutomationPhase(baseEvaluation(), 'generate', SLOTS)).toBe(true);
  });

  it('blocks generate and full when custom mode has no criteria', () => {
    const customWithoutCriteria = {
      ...baseEvaluation(),
      criteriaMode: 'custom' as const,
      criteria: [],
    };

    expect(canRunAutomationPhase(customWithoutCriteria, 'generate', SLOTS)).toBe(false);
    expect(canRunAutomationPhase(customWithoutCriteria, 'full', SLOTS)).toBe(false);
  });

  it('requires a full answer set matching expectedAnswerCount for score', () => {
    expect(canRunAutomationPhase(baseEvaluation(), 'score', SLOTS)).toBe(false);
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
        SLOTS,
      ),
    ).toBe(false);
    expect(
      canRunAutomationPhase(
        {
          ...baseEvaluation(),
          answers: [1, 2].map((n) => ({
            id: `a${n}`,
            evaluationId: 'eval-1',
            label: `M${n}`,
            content: `Hi ${n}`,
            scores: [],
          })),
        },
        'score',
        2,
      ),
    ).toBe(true);
    expect(
      canRunAutomationPhase(
        {
          ...baseEvaluation(),
          answers: [1, 2, 3].map((n) => ({
            id: `a${n}`,
            evaluationId: 'eval-1',
            label: `M${n}`,
            content: `Hi ${n}`,
            scores: [],
          })),
        },
        'score',
        SLOTS,
      ),
    ).toBe(true);
  });

  it('requires a winner for improved', () => {
    expect(canRunAutomationPhase(baseEvaluation(), 'improved', SLOTS)).toBe(false);
    expect(
      canRunAutomationPhase({ ...baseEvaluation(), winnerAnswerId: 'a1' }, 'improved', SLOTS),
    ).toBe(true);
  });
});
