import { jsonToSentences } from '../format/json-to-sentences.js';
import { stripModelArtifacts } from './sanitize-model-output.js';
import type { Answer, ImprovedAnswer, RubricCriterion } from '../types/evaluation.js';

export const GENERATE_SYSTEM =
  'You produce a candidate answer for automated evaluation. Reply directly to the user prompt in plain text—no JSON, no preamble about being an AI, and no mention of rubrics or scoring. Address every part of the request; be accurate and concise; use structure (lists, steps) when it helps readability.';

export const JUDGE_SCORE_SYSTEM =
  'You are an impartial rubric judge. Score one model answer at a time using only the rubric and the answer text—do not compare to other models. Return valid JSON only, matching the schema in the user message exactly.';

export const JUDGE_IMPROVED_SYSTEM =
  'You synthesize an improved answer after multi-model comparison. Return valid JSON only, matching the schema in the user message exactly. finalAnswer must be a polished, standalone reply to the original user prompt—not meta commentary about the evaluation.';

export const JSON_RETRY_SYSTEM =
  'Your previous response was not valid JSON. Reply with a single JSON object only—no markdown fences, no commentary before or after—and match the schema described in the user message.';

export function formatCriteriaBlock(criteria: RubricCriterion[]): string {
  return criteria
    .map(
      (c) =>
        `- id: ${c.id}, name: ${c.name}, maxPoints: ${c.maxPoints}${c.description ? `, description: ${c.description}` : ''}`,
    )
    .join('\n');
}

function formatAnswerSummary(answer: Answer): string {
  const total = answer.scores.reduce((s, sc) => s + sc.points, 0);
  const max = answer.scores.reduce((s, sc) => s + sc.maxPoints, 0);
  const scoreLines = answer.scores
    .map((s) => `  - ${s.criterionName}: ${s.points}/${s.maxPoints}`)
    .join('\n');

  return `### ${answer.label} (total ${total}/${max})${answer.isWinner ? ' [WINNER]' : ''}
Scores:
${scoreLines}

${stripModelArtifacts(answer.content)}`;
}

export const JUDGE_RANK_SYSTEM =
  'You compare multiple model answers on the same rubric. Return valid JSON only, matching the schema in the user message exactly.';

export function buildComparativeRankPrompt(
  prompt: string,
  criteria: RubricCriterion[],
  answers: Answer[],
): string {
  const summaries = answers
    .map((answer) => {
      const total = answer.scores.reduce((sum, score) => sum + score.points, 0);
      const max = answer.scores.reduce((sum, score) => sum + score.maxPoints, 0);

      return `- id: ${answer.id}, label: ${answer.label}, currentTotal: ${total}/${max}
${stripModelArtifacts(answer.content).slice(0, 1200)}`;
    })
    .join('\n\n');

  return `The answers below were scored independently but ended with identical totals. Rank them by overall rubric quality.

Original user prompt:
${prompt}

Rubric:
${formatCriteriaBlock(criteria)}

Answers:
${summaries}

Return JSON only:
{
  "rankings": [
    { "answerId": "<id>", "qualityPercent": <number 0-100> }
  ]
}

Rules:
- Include every answer id exactly once.
- qualityPercent reflects overall rubric strength (higher is better).
- Rankings must differ—do not assign the same qualityPercent to every answer.
- The best answer should have a clearly higher qualityPercent than the weakest.`;
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
    header: `Role: Impartial evaluator. Score the model answer below against each rubric criterion.

Original user prompt (what the answer should address):
${prompt}

Rubric (score each criterion independently):
${formatCriteriaBlock(criteria)}

Scoring rules:
- For each criterion, assign integer points from 0 through maxPoints (not percentages).
- points must be on the rubric scale (e.g. 0–5), never 0–100 unless maxPoints is 100.
- Base scores only on this answer and the criterion name/description—ignore other models.
- Use the full range: reserve maxPoints for strong performance; use 0 when clearly failed.
- Discriminate quality—avoid giving every criterion the same middling score unless deserved.
- notes (optional): one short sentence citing specific evidence from the answer; omit if nothing useful to add.

Required JSON shape (no other keys, no markdown):
{
  "scores": [
    { "criterionId": "<id>", "points": <number>, "notes": "<optional>" }
  ]
}

Include exactly one object per criterion id: ${criteriaIds.join(', ')}`,
  };
}

export function buildScorePrompt(context: ScorePromptContext, answer: Answer): string {
  return `${context.header}

---
Model answer to score (${answer.label}):
${stripModelArtifacts(answer.content)}`;
}

export function buildImprovedPrompt(
  prompt: string,
  criteria: RubricCriterion[],
  answers: Answer[],
  winner: Answer,
): string {
  const summaries = answers.map(formatAnswerSummary).join('\n\n');

  return `You are improving the best candidate answer after comparing multiple model outputs.

Original user prompt:
${prompt}

Rubric criteria (what a strong final answer should satisfy):
${formatCriteriaBlock(criteria)}

All model answers (with rubric scores):
${summaries}

Winner by total score: ${winner.label}

Task:
1. winningAnswer — briefly why this answer scored highest on the rubric.
2. strengths — what the winner did well.
3. weaknesses — gaps or errors to fix in the winner.
4. usefulFromOthers — specific ideas from non-winning answers worth merging.
5. finalAnswer — one improved reply that fully addresses the original user prompt; fix weaknesses, keep strengths, and selectively merge useful ideas. Write for the end user, not as a report about models or scores.

Return JSON only matching this shape:
{
  "winningAnswer": "<string>",
  "strengths": "<string>",
  "weaknesses": "<string>",
  "usefulFromOthers": "<string>",
  "finalAnswer": "<string>"
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

  const text = stripModelArtifacts(jsonToSentences(value));
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
