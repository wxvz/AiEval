import {
  DEFAULT_EVALUATION_CONFIG,
  Evaluation,
  RubricCriterion,
} from '../models';

function scoringRevisionParts(
  evaluation: Pick<Evaluation, 'prompt' | 'evaluationConfig' | 'criteriaMode' | 'criteria'>,
  criteria: RubricCriterion[],
  includePrompt: boolean,
): string[] {
  const config = evaluation.evaluationConfig ?? DEFAULT_EVALUATION_CONFIG;
  const criteriaKey = criteria
    .map((criterion) => `${criterion.id}:${criterion.maxPoints}:${criterion.weight}`)
    .join('|');

  const parts = [
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
  ];

  return includePrompt ? [evaluation.prompt, ...parts] : parts;
}

export function computeScoringConfigRevision(
  evaluation: Pick<Evaluation, 'prompt' | 'evaluationConfig' | 'criteriaMode' | 'criteria'>,
  criteria: RubricCriterion[],
): string {
  return scoringRevisionParts(evaluation, criteria, true).join('::');
}

/** Pre-prompt formula — used only to grandfather historical revisions after the prompt bump. */
export function computeLegacyScoringConfigRevision(
  evaluation: Pick<Evaluation, 'evaluationConfig' | 'criteriaMode' | 'criteria'>,
  criteria: RubricCriterion[],
): string {
  return scoringRevisionParts(
    { ...evaluation, prompt: '' },
    criteria,
    false,
  ).join('::');
}

export function scoresMayBeStale(evaluation: Evaluation, criteria: RubricCriterion[]): boolean {
  if (!evaluation.automatedAt || !evaluation.scoringConfigRevision) {
    return false;
  }

  const current = computeScoringConfigRevision(evaluation, criteria);
  if (evaluation.scoringConfigRevision === current) {
    return false;
  }

  // Avoid a one-time stale banner wave for scores written before prompt was hashed.
  // Prompt-only edits on those records stay grandfathered until the next automation run.
  const legacy = computeLegacyScoringConfigRevision(evaluation, criteria);
  if (evaluation.scoringConfigRevision === legacy) {
    return false;
  }

  return true;
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
