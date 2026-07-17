import {
  DEFAULT_EVALUATION_CONFIG,
  Evaluation,
  RubricCriterion,
} from '../models';

export function computeScoringConfigRevision(
  evaluation: Pick<Evaluation, 'evaluationConfig' | 'criteriaMode' | 'criteria'>,
  criteria: RubricCriterion[],
): string {
  const config = evaluation.evaluationConfig ?? DEFAULT_EVALUATION_CONFIG;
  const criteriaKey = criteria
    .map((criterion) => `${criterion.id}:${criterion.maxPoints}:${criterion.weight}`)
    .join('|');

  return [
    evaluation.criteriaMode,
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

export function scoresMayBeStale(evaluation: Evaluation, criteria: RubricCriterion[]): boolean {
  if (!evaluation.automatedAt || !evaluation.scoringConfigRevision) {
    return false;
  }

  return evaluation.scoringConfigRevision !== computeScoringConfigRevision(evaluation, criteria);
}

export function formatRunEstimateLabel(estimate: {
  estimatedTokensMin: number;
  estimatedTokensMax: number;
  estimatedDurationSecondsMin: number;
  estimatedDurationSecondsMax: number;
}): string {
  const minutesMin = Math.max(1, Math.round(estimate.estimatedDurationSecondsMin / 60));
  const minutesMax = Math.max(minutesMin, Math.round(estimate.estimatedDurationSecondsMax / 60));

  return `~${estimate.estimatedTokensMin.toLocaleString()}–${estimate.estimatedTokensMax.toLocaleString()} tokens · ~${minutesMin}–${minutesMax} min`;
}
