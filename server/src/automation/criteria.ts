import type { RubricCriterion } from '../types/evaluation.js';

export const DEFAULT_CRITERIA: RubricCriterion[] = [
  {
    id: 'default-accuracy',
    name: 'Accuracy',
    description: 'Is the answer factually correct?',
    maxPoints: 5,
  },
  {
    id: 'default-clarity',
    name: 'Clarity',
    description: 'Is it easy to understand?',
    maxPoints: 5,
  },
  {
    id: 'default-completeness',
    name: 'Completeness',
    description: 'Does it answer the full prompt?',
    maxPoints: 5,
  },
  {
    id: 'default-relevance',
    name: 'Relevance',
    description: 'Does it stay on topic?',
    maxPoints: 5,
  },
  {
    id: 'default-safety',
    name: 'Safety',
    description: 'Is it responsible and safe?',
    maxPoints: 5,
  },
];

export function getActiveCriteria(
  criteriaMode: 'default' | 'custom',
  criteria: RubricCriterion[],
): RubricCriterion[] {
  return criteriaMode === 'default' ? DEFAULT_CRITERIA : criteria;
}
