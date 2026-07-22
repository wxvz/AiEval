import type {
  EvaluationAudience,
  EvaluationConfig,
  EvaluationGoal,
  ResponseFormat,
  TaskDifficulty,
} from './types/evaluation.js';

const DIFFICULTIES = new Set<TaskDifficulty>(['easy', 'balanced', 'hard']);
const GOALS = new Set<EvaluationGoal>([
  'general',
  'coding',
  'reasoning',
  'grounded',
  'safety',
  'creative',
]);
const AUDIENCES = new Set<EvaluationAudience>(['general', 'beginner', 'expert', 'executive']);
const FORMATS = new Set<ResponseFormat>(['freeform', 'paragraphs', 'bullets', 'json', 'code']);

export const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  taskDifficulty: 'balanced',
  goal: 'general',
  audience: 'general',
  responseConstraints: {
    format: 'freeform',
    requireCitations: false,
    requireCode: false,
    requireTests: false,
  },
  blindJudging: true,
  judgeProfile: {
    strictness: 'balanced',
  },
};

/** Response-constraint defaults for batch config grids and goal-specific presets. */
export function responseConstraintsForGoal(
  goal: EvaluationGoal,
  taskDifficulty: TaskDifficulty = DEFAULT_EVALUATION_CONFIG.taskDifficulty,
): EvaluationConfig['responseConstraints'] {
  const base = { ...DEFAULT_EVALUATION_CONFIG.responseConstraints };

  if (goal === 'grounded') {
    return { ...base, requireCitations: true };
  }

  if (goal === 'coding') {
    return {
      ...base,
      requireCode: true,
      requireTests: taskDifficulty !== 'easy',
    };
  }

  return base;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value as T) ? (value as T) : fallback;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function normalizeEvaluationConfig(value: unknown): EvaluationConfig {
  const input = record(value);
  const constraints = record(input['responseConstraints']);
  const judgeProfile = record(input['judgeProfile']);
  const maxWords =
    typeof constraints['maxWords'] === 'number' &&
    Number.isFinite(constraints['maxWords']) &&
    constraints['maxWords'] > 0
      ? Math.round(constraints['maxWords'])
      : undefined;
  const expectedAnswer = optionalText(input['expectedAnswer']);
  const model = optionalText(judgeProfile['model']);

  return {
    taskDifficulty: enumValue(
      input['taskDifficulty'],
      DIFFICULTIES,
      DEFAULT_EVALUATION_CONFIG.taskDifficulty,
    ),
    goal: enumValue(input['goal'], GOALS, DEFAULT_EVALUATION_CONFIG.goal),
    audience: enumValue(input['audience'], AUDIENCES, DEFAULT_EVALUATION_CONFIG.audience),
    responseConstraints: {
      ...(maxWords ? { maxWords } : {}),
      format: enumValue(
        constraints['format'],
        FORMATS,
        DEFAULT_EVALUATION_CONFIG.responseConstraints.format,
      ),
      requireCitations: constraints['requireCitations'] === true,
      requireCode: constraints['requireCode'] === true,
      requireTests: constraints['requireTests'] === true,
    },
    ...(expectedAnswer ? { expectedAnswer } : {}),
    blindJudging:
      typeof input['blindJudging'] === 'boolean'
        ? input['blindJudging']
        : DEFAULT_EVALUATION_CONFIG.blindJudging,
    judgeProfile: {
      strictness: enumValue(
        judgeProfile['strictness'],
        DIFFICULTIES,
        DEFAULT_EVALUATION_CONFIG.judgeProfile.strictness,
      ),
      ...(model ? { model } : {}),
    },
  };
}
