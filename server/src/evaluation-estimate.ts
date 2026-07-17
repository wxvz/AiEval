import { resolveProvider } from './llm/provider.js';
import type { AutomationPhase } from './llm/types.js';
import type { EvaluationConfig, EvaluationRecord, RubricCriterion } from './types/evaluation.js';

export interface EvaluationRunEstimate {
  answerCount: number;
  criteriaCount: number;
  phases: AutomationPhase[];
  estimatedTokensMin: number;
  estimatedTokensMax: number;
  estimatedDurationSecondsMin: number;
  estimatedDurationSecondsMax: number;
  costUsd: null;
}

const BASE_PROMPT_TOKENS = 400;
const TOKENS_PER_ANSWER = 900;
const TOKENS_PER_CRITERION = 120;
const TOKENS_IMPROVED = 1200;
const SECONDS_PER_ANSWER = 25;
const SECONDS_SCORING = 35;
const SECONDS_IMPROVED = 30;

export async function estimateEvaluationRun(
  record: Pick<
    EvaluationRecord,
    'prompt' | 'criteriaMode' | 'criteria' | 'answers' | 'evaluationConfig'
  >,
  phase: AutomationPhase = 'full',
): Promise<EvaluationRunEstimate> {
  const setup = await resolveProvider();
  const answerCount =
    record.answers.length > 0 ? record.answers.length : setup.answerModels.length;
  const criteria: RubricCriterion[] =
    record.criteriaMode === 'default'
      ? record.criteria.length > 0
        ? record.criteria
        : []
      : record.criteria;
  const criteriaCount = criteria.length > 0 ? criteria.length : 5;
  const promptTokens = Math.ceil(record.prompt.length / 4);
  const phases: AutomationPhase[] =
    phase === 'full' ? ['generate', 'score', 'improved'] : [phase];

  let tokenMin = BASE_PROMPT_TOKENS + promptTokens;
  let tokenMax = tokenMin + 500;
  let durationMin = 0;
  let durationMax = 0;

  if (phases.includes('generate')) {
    const generateTokens = answerCount * TOKENS_PER_ANSWER + promptTokens;
    tokenMin += generateTokens;
    tokenMax += generateTokens + answerCount * 400;
    durationMin += answerCount * SECONDS_PER_ANSWER;
    durationMax += answerCount * (SECONDS_PER_ANSWER + 20);
  }

  if (phases.includes('score')) {
    const scoreTokens =
      answerCount * criteriaCount * TOKENS_PER_CRITERION + promptTokens + criteriaCount * 200;
    tokenMin += scoreTokens;
    tokenMax += scoreTokens + 800;
    durationMin += SECONDS_SCORING;
    durationMax += SECONDS_SCORING + 25;
  }

  if (phases.includes('improved')) {
    tokenMin += TOKENS_IMPROVED;
    tokenMax += TOKENS_IMPROVED + 600;
    durationMin += SECONDS_IMPROVED;
    durationMax += SECONDS_IMPROVED + 20;
  }

  return {
    answerCount,
    criteriaCount,
    phases,
    estimatedTokensMin: tokenMin,
    estimatedTokensMax: tokenMax,
    estimatedDurationSecondsMin: durationMin,
    estimatedDurationSecondsMax: durationMax,
    costUsd: null,
  };
}
