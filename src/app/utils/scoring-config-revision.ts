import {
  DEFAULT_EVALUATION_CONFIG,
  Evaluation,
  RubricCriterion,
} from '../models';

function criteriaKey(criteria: RubricCriterion[], includeRubricText: boolean): string {
  return criteria
    .map((criterion) =>
      includeRubricText
        ? `${criterion.id}:${criterion.name}:${criterion.description ?? ''}:${criterion.maxPoints}:${criterion.weight}`
        : `${criterion.id}:${criterion.maxPoints}:${criterion.weight}`,
    )
    .join('|');
}

function scoringRevisionParts(
  evaluation: Pick<Evaluation, 'prompt' | 'evaluationConfig' | 'criteriaMode' | 'criteria'>,
  criteria: RubricCriterion[],
  options: { includePrompt: boolean; includeRubricText: boolean },
): string[] {
  const config = evaluation.evaluationConfig ?? DEFAULT_EVALUATION_CONFIG;

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
    criteriaKey(criteria, options.includeRubricText),
  ];

  return options.includePrompt ? [evaluation.prompt, ...parts] : parts;
}

export function computeScoringConfigRevision(
  evaluation: Pick<Evaluation, 'prompt' | 'evaluationConfig' | 'criteriaMode' | 'criteria'>,
  criteria: RubricCriterion[],
): string {
  return scoringRevisionParts(evaluation, criteria, {
    includePrompt: true,
    includeRubricText: true,
  }).join('::');
}

/** Pre-prompt formula — used only to grandfather historical revisions after the prompt bump. */
export function computeLegacyScoringConfigRevision(
  evaluation: Pick<Evaluation, 'evaluationConfig' | 'criteriaMode' | 'criteria'>,
  criteria: RubricCriterion[],
): string {
  return scoringRevisionParts(
    { ...evaluation, prompt: '' },
    criteria,
    { includePrompt: false, includeRubricText: true },
  ).join('::');
}

/** Pre-rubric-text formula — grandfathers hashes that omitted name/description. */
export function computeLegacyCriteriaScoringConfigRevision(
  evaluation: Pick<Evaluation, 'prompt' | 'evaluationConfig' | 'criteriaMode' | 'criteria'>,
  criteria: RubricCriterion[],
  includePrompt: boolean,
): string {
  return scoringRevisionParts(evaluation, criteria, {
    includePrompt,
    includeRubricText: false,
  }).join('::');
}

export function scoresMayBeStale(evaluation: Evaluation, criteria: RubricCriterion[]): boolean {
  if (!evaluation.automatedAt || !evaluation.scoringConfigRevision) {
    return false;
  }

  const stored = evaluation.scoringConfigRevision;
  const current = computeScoringConfigRevision(evaluation, criteria);
  if (stored === current) {
    return false;
  }

  // Avoid a one-time stale banner wave for scores written before prompt was hashed.
  // Prompt-only edits on those records stay grandfathered until the next automation run.
  if (stored === computeLegacyScoringConfigRevision(evaluation, criteria)) {
    return false;
  }

  // Same for scores written before criterion name/description entered the hash.
  if (stored === computeLegacyCriteriaScoringConfigRevision(evaluation, criteria, true)) {
    return false;
  }

  if (stored === computeLegacyCriteriaScoringConfigRevision(evaluation, criteria, false)) {
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
