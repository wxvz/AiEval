import { jsonToSentences } from '../format/json-to-sentences.js';
import type { Answer, ImprovedAnswer, RubricCriterion } from '../types/evaluation.js';

export const GENERATE_SYSTEM =
  'You are a helpful assistant. Answer the user prompt clearly and concisely.';

export const JSON_RETRY_SYSTEM =
  'You must respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON object.';

export function formatCriteriaBlock(criteria: RubricCriterion[]): string {
  return criteria
    .map(
      (c) =>
        `- id: ${c.id}, name: ${c.name}, maxPoints: ${c.maxPoints}${c.description ? `, description: ${c.description}` : ''}`,
    )
    .join('\n');
}

export interface ScorePromptContext {
  header: string;
  criteriaIds: string[];
}

export function buildScorePromptContext(
  prompt: string,
  criteria: RubricCriterion[],
): ScorePromptContext {
  const criteriaIds = criteria.map((c) => c.id);

  return {
    criteriaIds,
    header: `You are an evaluation judge. Score each model answer against the rubric.

User prompt:
${prompt}

Rubric criteria:
${formatCriteriaBlock(criteria)}

Return JSON only:
{
  "scores": [
    { "criterionId": "<id>", "points": <0 to maxPoints>, "notes": "<optional brief note>" }
  ]
}

Use criterion ids: ${criteriaIds.join(', ')}`,
  };
}

export function buildScorePrompt(context: ScorePromptContext, answer: Answer): string {
  return `${context.header}

Model answer (${answer.label}):
${answer.content}`;
}

export function buildImprovedPrompt(
  prompt: string,
  criteria: RubricCriterion[],
  answers: Answer[],
  winner: Answer,
): string {
  const summaries = answers
    .map((a) => {
      const total = a.scores.reduce((s, sc) => s + sc.points, 0);
      const max = a.scores.reduce((s, sc) => s + sc.maxPoints, 0);
      return `### ${a.label} (total ${total}/${max})${a.isWinner ? ' [WINNER]' : ''}\n${a.content}`;
    })
    .join('\n\n');

  const criteriaNames = criteria.map((c) => c.name).join(', ');

  return `You are helping improve an AI response after comparing multiple model answers.

Original user prompt:
${prompt}

Criteria used: ${criteriaNames}

All model answers:
${summaries}

Winner: ${winner.label}

Return JSON only matching this shape:
{
  "winningAnswer": "<summary of why winner won>",
  "strengths": "<winner strengths>",
  "weaknesses": "<winner weaknesses>",
  "usefulFromOthers": "<ideas from non-winning answers>",
  "finalAnswer": "<improved final response to the user prompt>"
}`;
}

function readImprovedField(
  record: Record<string, unknown>,
  key: keyof ImprovedAnswer,
): string | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    return undefined;
  }

  const text = jsonToSentences(value);
  return text || undefined;
}

export function parseImprovedAnswer(raw: unknown): ImprovedAnswer {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid improved answer JSON');
  }

  const record = raw as Record<string, unknown>;
  const improved: ImprovedAnswer = {};

  for (const key of [
    'winningAnswer',
    'strengths',
    'weaknesses',
    'usefulFromOthers',
    'finalAnswer',
  ] as const) {
    const text = readImprovedField(record, key);

    if (text) {
      improved[key] = text;
    }
  }

  return improved;
}
