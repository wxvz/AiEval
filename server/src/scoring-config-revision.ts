import type { EvaluationRecord, RubricCriterion } from './types/evaluation.js';
import { normalizeEvaluationConfig } from './evaluation-config.js';

export function computeScoringConfigRevision(
  record: Pick<EvaluationRecord, 'evaluationConfig' | 'criteriaMode' | 'criteria'>,
  criteria: RubricCriterion[],
): string {
  const config = normalizeEvaluationConfig(record.evaluationConfig);
  const criteriaKey = criteria
    .map((criterion) => `${criterion.id}:${criterion.maxPoints}:${criterion.weight}`)
    .join('|');

  return [
    record.criteriaMode,
    config.goal,
    config.taskDifficulty,
    config.audience,
    config.blindJudging ? 'blind' : 'visible',
    config.judgeProfile.strictness,
    config.judgeProfile.model ?? '',
    config.expectedAnswer ?? '',
    config.responseConstraints.format,
    String(config.responseConstraints.maxWords ?? ''),
    config.responseConstraints.requireCitations ? '1' : '0',
    config.responseConstraints.requireCode ? '1' : '0',
    config.responseConstraints.requireTests ? '1' : '0',
    criteriaKey,
  ].join('::');
}
