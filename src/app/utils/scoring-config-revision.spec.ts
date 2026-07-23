import { DEFAULT_EVALUATION_CONFIG, type Evaluation, type RubricCriterion } from '../models';
import {
  computeLegacyCriteriaScoringConfigRevision,
  computeLegacyScoringConfigRevision,
  computeScoringConfigRevision,
  scoresMayBeStale,
} from './scoring-config-revision';

describe('computeScoringConfigRevision', () => {
  const criteria: RubricCriterion[] = [
    { id: 'a', name: 'A', description: 'Accurate', maxPoints: 5, weight: 1 },
  ];

  function evaluation(
    overrides: Partial<Pick<Evaluation, 'prompt' | 'scoringConfigRevision' | 'automatedAt'>> = {},
  ): Evaluation {
    return {
      id: 'e1',
      title: 'T',
      prompt: overrides.prompt ?? 'Original prompt',
      criteriaMode: 'default',
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      automatedAt: overrides.automatedAt,
      scoringConfigRevision: overrides.scoringConfigRevision,
    };
  }

  it('changes when the evaluation prompt changes', () => {
    const original = computeScoringConfigRevision(evaluation({ prompt: 'Prompt A' }), criteria);
    const revised = computeScoringConfigRevision(evaluation({ prompt: 'Prompt B' }), criteria);

    expect(original).not.toBe(revised);
  });

  it('changes when criterion description changes', () => {
    const original = computeScoringConfigRevision(evaluation(), criteria);
    const revised = computeScoringConfigRevision(evaluation(), [
      { ...criteria[0], description: 'New meaning' },
    ]);

    expect(original).not.toBe(revised);
  });

  it('marks scores stale after a prompt edit on a current revision', () => {
    const scored = evaluation({
      prompt: 'Prompt A',
      automatedAt: '2024-01-02T00:00:00.000Z',
    });
    const revision = computeScoringConfigRevision(scored, criteria);
    const edited = evaluation({
      prompt: 'Prompt B',
      automatedAt: scored.automatedAt,
      scoringConfigRevision: revision,
    });

    expect(scoresMayBeStale(edited, criteria)).toBe(true);
  });

  it('marks scores stale after a rubric description edit on a current revision', () => {
    const scored = evaluation({
      automatedAt: '2024-01-02T00:00:00.000Z',
    });
    const revision = computeScoringConfigRevision(scored, criteria);
    const editedCriteria = [{ ...criteria[0], description: 'Changed' }];

    expect(
      scoresMayBeStale(
        { ...scored, scoringConfigRevision: revision },
        editedCriteria,
      ),
    ).toBe(true);
  });

  it('grandfathers pre-prompt revisions so deploy does not mark every score stale', () => {
    const scored = evaluation({
      prompt: 'Prompt A',
      automatedAt: '2024-01-02T00:00:00.000Z',
      scoringConfigRevision: computeLegacyScoringConfigRevision(
        evaluation({ prompt: 'Prompt A' }),
        criteria,
      ),
    });

    expect(scoresMayBeStale(scored, criteria)).toBe(false);
  });

  it('grandfathers pre-rubric-text revisions so deploy does not mark every score stale', () => {
    const scored = evaluation({
      prompt: 'Prompt A',
      automatedAt: '2024-01-02T00:00:00.000Z',
      scoringConfigRevision: computeLegacyCriteriaScoringConfigRevision(
        evaluation({ prompt: 'Prompt A' }),
        criteria,
        true,
      ),
    });

    expect(scoresMayBeStale(scored, criteria)).toBe(false);
  });
});
