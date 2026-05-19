import { describe, expect, it } from 'vitest';

import { DEFAULT_CRITERIA } from './criteria.js';
import {
  BUILT_IN_RUBRIC_ANCHORS,
  formatAnchorDescription,
  formatRubricBlock,
  getCriterionAnchors,
  getDiscreteAnchorPoints,
  matchesBuiltInDefaultRubric,
  parseAnchorsFromDescription,
  usesDiscreteAnchors,
  usesStandardFivePointAnchors,
  usesStandardOneThreeFiveAnchors,
} from './rubric-anchors.js';
import type { RubricCriterion } from '../types/evaluation.js';

describe('built-in rubric anchors', () => {
  it('defines five criteria with 1–5 anchors', () => {
    expect(BUILT_IN_RUBRIC_ANCHORS).toHaveLength(5);
    expect(BUILT_IN_RUBRIC_ANCHORS.map((c) => c.name)).toEqual([
      'Accuracy',
      'Clarity',
      'Completeness',
      'Relevance',
      'Safety',
    ]);

    for (const criterion of BUILT_IN_RUBRIC_ANCHORS) {
      expect(criterion.anchors.map((anchor) => anchor.points)).toEqual([5, 4, 3, 2, 1]);
    }
  });

  it('builds default criteria with stable ids and anchor descriptions', () => {
    expect(DEFAULT_CRITERIA).toHaveLength(5);
    expect(DEFAULT_CRITERIA[0]?.id).toBe('default-accuracy');
    expect(DEFAULT_CRITERIA[0]?.description).toContain('Fully correct with no misleading claims');
    expect(DEFAULT_CRITERIA[0]?.description).not.toContain('.;');
    expect(formatAnchorDescription(BUILT_IN_RUBRIC_ANCHORS[0]!.anchors)).toContain('5 =');
  });

  it('formats built-in rubric for judge prompts', () => {
    const block = formatRubricBlock(DEFAULT_CRITERIA);

    expect(block).toContain('Accuracy');
    expect(block).toContain('5 = Fully correct with no misleading claims');
    expect(block).toContain('default-safety');
    expect(usesDiscreteAnchors(DEFAULT_CRITERIA)).toBe(true);
    expect(usesStandardFivePointAnchors(DEFAULT_CRITERIA)).toBe(true);
    expect(usesStandardOneThreeFiveAnchors(DEFAULT_CRITERIA)).toBe(false);
  });

  it('detects built-in rubric by default criterion ids only', () => {
    expect(matchesBuiltInDefaultRubric(DEFAULT_CRITERIA)).toBe(true);

    const byName: RubricCriterion[] = BUILT_IN_RUBRIC_ANCHORS.map((criterion) => ({
      id: `custom-${criterion.name.toLowerCase()}`,
      name: criterion.name,
      maxPoints: 5,
    }));

    expect(matchesBuiltInDefaultRubric(byName)).toBe(false);
    expect(getCriterionAnchors(byName[0]!, byName)).toBeNull();
  });

  it('parses custom anchor descriptions', () => {
    const parsed = parseAnchorsFromDescription('5 = Excellent; 3 = Adequate; 1 = Poor');

    expect(parsed).toEqual([
      { points: 5, description: 'Excellent' },
      { points: 3, description: 'Adequate' },
      { points: 1, description: 'Poor' },
    ]);
  });

  it('formats custom criteria with embedded anchors', () => {
    const criteria: RubricCriterion[] = [
      {
        id: 'tone',
        name: 'Tone',
        maxPoints: 5,
        description: '5 = Professional; 3 = Neutral; 1 = Rude',
      },
    ];

    const block = formatRubricBlock(criteria);

    expect(block).toContain('5 = Professional');
    expect(getDiscreteAnchorPoints(criteria[0]!, criteria)).toEqual([5, 3, 1]);
    expect(usesDiscreteAnchors(criteria)).toBe(true);
    expect(usesStandardOneThreeFiveAnchors(criteria)).toBe(true);
  });

  it('formats custom criteria without anchors as continuous scale', () => {
    const criteria: RubricCriterion[] = [
      { id: 'quality', name: 'Quality', maxPoints: 10, description: 'Overall answer quality.' },
    ];

    const block = formatRubricBlock(criteria);

    expect(block).toContain('maxPoints: 10');
    expect(block).toContain('Overall answer quality');
    expect(usesDiscreteAnchors(criteria)).toBe(false);
  });

  it('does not treat arbitrary five-point criteria as discrete anchors', () => {
    const criteria: RubricCriterion[] = [
      { id: 'a', name: 'Argument', maxPoints: 5 },
      { id: 'b', name: 'Evidence', maxPoints: 5 },
    ];

    expect(usesDiscreteAnchors(criteria)).toBe(false);
  });
});
