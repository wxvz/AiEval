import type { RubricCriterion } from '../types/evaluation.js';
import { buildDefaultCriteriaFromAnchors } from './rubric-anchors.js';

export const DEFAULT_CRITERIA: RubricCriterion[] = buildDefaultCriteriaFromAnchors();

export function getActiveCriteria(
  criteriaMode: 'default' | 'custom',
  criteria: RubricCriterion[],
): RubricCriterion[] {
  return criteriaMode === 'default' ? DEFAULT_CRITERIA : criteria;
}
