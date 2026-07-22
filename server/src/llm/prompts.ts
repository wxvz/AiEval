import {
  formatRubricBlock,
  usesDiscreteAnchors,
  usesStandardFivePointAnchors,
  usesStandardOneThreeFiveAnchors,
} from '../automation/rubric-anchors.js';
import { jsonToSentences } from '../format/json-to-sentences.js';
import { stripModelArtifacts } from './sanitize-model-output.js';
import type { Answer, ImprovedAnswer, RubricCriterion } from '../types/evaluation.js';

export const GENERATE_SYSTEM =
  'You produce a candidate answer for automated evaluation. Reply directly to the user prompt in plain text—no JSON, no preamble about being an AI, and no mention of rubrics or scoring. Do not wrap the reply in chain-of-thought or thinking markup tags; do not emit constraint checklists, self-correction, or verification notes. Output only the final answer. Address every part of the request; be accurate and concise; use structure (lists, steps) when it helps readability.';

export const TITLE_GENERATE_SYSTEM = `You create clear evaluation titles for an AI response evaluation app. Generate one concise title that can later be used to create a challenging prompt for comparing language model answers. The title should be specific, balanced, realistic, and not too broad. Choose a topic yourself. Across separate requests, vary the subject area and angle; do not reuse the same topic or near-duplicate wording. Avoid vague titles, clickbait, jokes, or overly broad topics. Output only the title, with no extra explanation.`;

/** @deprecated Use {@link buildTitleGenerateUser} for autonomous title generation. */
export const TITLE_GENERATE_USER = 'Generate an evaluation title.';

const TITLE_TOPIC_DOMAINS = [
  'science and technology',
  'public policy and civic life',
  'business and economics',
  'health and medicine',
  'education and learning',
  'environment and sustainability',
  'ethics and philosophy',
  'arts and culture',
  'history and society',
  'work and careers',
  'communication and media',
  'law and regulation',
] as const;

export function buildTitleGenerateUser(): string {
  const domain = TITLE_TOPIC_DOMAINS[Math.floor(Math.random() * TITLE_TOPIC_DOMAINS.length)]!;
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return `Generate an evaluation title. Lean toward the "${domain}" area for this request, but keep the title specific and balanced. Request id: ${requestId}.`;
}

export const PROMPT_GENERATE_SYSTEM = `You draft evaluation prompts for comparing how different language models answer the same user request. Given only an evaluation title, write one clear user prompt that models should answer directly.

Use plain text only: no JSON, markdown fences, headings, labels, or meta commentary. Do not write a long essay-style task unless the title clearly asks for an essay.

The prompt must be specific enough to score using Accuracy, Clarity, Completeness, Relevance, and Safety or custom criteria. It should include concrete requirements and success criteria where useful, but stay concise enough for model answers to be compared easily.

Make the prompt challenging enough that weak or vague answers lose marks. Prefer balanced reasoning, practical examples, trade-offs, and realistic conclusions. When examples are needed, ask for one short example, not multiple case studies, unless the title requires it.

The final prompt should usually be one short paragraph of 3–6 sentences. Only output the final prompt.`;

export function buildPromptGenerateUser(title: string): string {
  return `Evaluation title:
${title.trim()}

Write the user prompt that candidates will answer for this evaluation.`;
}

/** @deprecated Prefer {@link JUDGE_BATCH_SCORE_SYSTEM}; kept for tests / tooling that still build single-answer prompts. */
export const JUDGE_SCORE_SYSTEM =
  'You are an impartial rubric judge. Score one model answer at a time using only the rubric anchors and the answer text—do not compare to other models. When the rubric lists discrete score anchors, pick the single anchor that best fits; do not invent scores outside those anchors. Return valid JSON only, matching the schema in the user message exactly.';

export const JUDGE_BATCH_SCORE_SYSTEM =
  'You are an impartial rubric judge. Multiple candidate answers are indexed together—read and compare them, then score each answer separately against the rubric anchors. Use comparison only to calibrate discrimination when anchors alone would blur differences; each criterion score must still match the anchor definitions for that answer text (no invented anchor values). Return valid JSON only, matching the schema in the user message exactly.';

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

  return `The answers below share the same total rubric score. Rank them by overall rubric quality.

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

function buildScoringRules(criteria: RubricCriterion[], comparative: boolean): string {
  const anchorRules = usesDiscreteAnchors(criteria)
    ? usesStandardOneThreeFiveAnchors(criteria)
      ? `- For each criterion, assign exactly one of these point values: 1, 3, or 5 (maxPoints is 5). Never use 0, 2, or 4.
- Match the rubric anchor whose description best fits the answer; if between two anchors, choose the lower score.
- In notes, start with the chosen score and anchor gist (e.g. "3 — mostly correct but missing precision: …").`
      : usesStandardFivePointAnchors(criteria)
        ? `- For each criterion, assign exactly one integer from 1 through 5 (maxPoints is 5). Never use 0.
- Match the rubric anchor whose description best fits the answer; if between two anchors, choose the lower score.
- In notes, start with the chosen score and anchor gist (e.g. "4 — mostly correct with minor missing precision: …").`
        : `- For each criterion with listed anchors, assign exactly one of that criterion's anchor point values—never invent intermediate scores.
- Match the rubric anchor whose description best fits the answer; if between two anchors, choose the lower score.
- In notes, start with the chosen score and anchor gist.`
    : `- For each criterion, assign integer points from 0 through maxPoints (not percentages).
- points must be on the rubric scale, never 0–100 unless maxPoints is 100.
- Use the full range: reserve maxPoints for strong performance; use 0 when clearly failed.`;

  const calibrationRule = comparative
    ? `- All indexed answers appear together. Compare them to calibrate scores when differences matter under the rubric; still ground each criterion score in that answer's own text versus the anchors (do not inflate weak answers just to spread totals).`
    : `- Base scores only on this answer and the rubric—ignore other models.`;

  return `Scoring rules:
${anchorRules}
${calibrationRule}
- Discriminate quality—avoid giving every criterion the same score unless deserved.
- notes: one short sentence per criterion citing specific evidence from the answer.
- answerNotes: required per answer—2–3 sentences summarizing overall rubric performance (strengths, gaps, rationale).`;
}

export function buildScorePromptContext(
  prompt: string,
  criteria: RubricCriterion[],
): ScorePromptContext {
  const criteriaIds = criteria.map((c) => c.id);
  const rubricBlock = formatRubricBlock(criteria);

  return {
    criteriaIds,
    header: `Role: Impartial evaluator. Score the model answer below against each rubric criterion.

Original user prompt (what the answer should address):
${prompt}

Rubric (score each criterion independently; use the anchor descriptions):
${rubricBlock}

${buildScoringRules(criteria, false)}

Required JSON shape (no other keys, no markdown):
{
  "answerNotes": "<brief overall rationale>",
  "scores": [
    { "criterionId": "<id>", "points": <number>, "notes": "<brief evidence>" }
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

/**
 * One user message: rubric + every candidate answer with stable indices for comparative scoring.
 */
export function buildBatchScorePrompt(prompt: string, criteria: RubricCriterion[], answers: Answer[]): string {
  const criteriaIds = criteria.map((c) => c.id);
  const rubricBlock = formatRubricBlock(criteria);

  const indexedBlocks = answers
    .map((answer, index) => {
      const n = index + 1;

      return `### Answer ${n} (index ${n})
- answerId: ${answer.id}
- modelLabel: ${answer.label}

${stripModelArtifacts(answer.content)}`;
    })
    .join('\n\n');

  return `Role: Impartial evaluator. Score every indexed candidate answer against each rubric criterion.

Original user prompt (what each answer should address):
${prompt}

Rubric (score each criterion independently per answer; use the anchor descriptions):
${rubricBlock}

${buildScoringRules(criteria, true)}

Indexed candidate answers:
${indexedBlocks}

Required JSON shape (no other keys, no markdown):
{
  "answers": [
    {
      "answerIndex": <1-based index, must match "Answer N">,
      "answerId": "<same uuid as listed>",
      "answerNotes": "<brief overall rationale>",
      "scores": [
        { "criterionId": "<id>", "points": <number>, "notes": "<brief evidence>" }
      ]
    }
  ]
}

Include exactly one object per indexed answer (${answers.length} total), in any order.
For each answer object, include exactly one score row per criterion id: ${criteriaIds.join(', ')}`;
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
