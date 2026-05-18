import type { Answer, ImprovedAnswer, RubricCriterion } from '../types/evaluation.js';

export const GENERATE_SYSTEM =
  'You are a helpful assistant. Answer the user prompt clearly and concisely.';

export const JSON_RETRY_SYSTEM =
  'You must respond with valid JSON only. No markdown, no code fences, no explanation outside the JSON object.';

export function buildScorePrompt(
  prompt: string,
  criteria: RubricCriterion[],
  answer: Answer,
): string {
  const criteriaLines = criteria
    .map(
      (c) =>
        `- id: ${c.id}, name: ${c.name}, maxPoints: ${c.maxPoints}${c.description ? `, description: ${c.description}` : ''}`,
    )
    .join('\n');

  return `You are an evaluation judge. Score this model answer against each rubric criterion.

User prompt:
${prompt}

Rubric criteria:
${criteriaLines}

Model answer (${answer.label}):
${answer.content}

Return JSON only:
{
  "scores": [
    { "criterionId": "<id>", "points": <0 to maxPoints>, "notes": "<optional brief note>" }
  ]
}`;
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

export function parseImprovedAnswer(raw: unknown): ImprovedAnswer {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid improved answer JSON');
  }

  const record = raw as Record<string, unknown>;

  return {
    ...(typeof record['winningAnswer'] === 'string'
      ? { winningAnswer: record['winningAnswer'] }
      : {}),
    ...(typeof record['strengths'] === 'string' ? { strengths: record['strengths'] } : {}),
    ...(typeof record['weaknesses'] === 'string' ? { weaknesses: record['weaknesses'] } : {}),
    ...(typeof record['usefulFromOthers'] === 'string'
      ? { usefulFromOthers: record['usefulFromOthers'] }
      : {}),
    ...(typeof record['finalAnswer'] === 'string' ? { finalAnswer: record['finalAnswer'] } : {}),
  };
}
