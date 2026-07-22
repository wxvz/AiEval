export interface JudgeScoreEntry {
  criterionId: string;
  points: unknown;
  notes?: unknown;
}

export interface ParsedJudgeOutput {
  ok: boolean;
  scores: Array<{ criterionId: string; points: number; notes?: string }>;
  answerNotes?: string;
  error?: string;
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenceMatch ? fenceMatch[1]!.trim() : trimmed;
}

function readNotes(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

export function parseJudgeOutput(raw: string): ParsedJudgeOutput {
  const cleaned = stripJsonFences(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, scores: [], error: 'Invalid JSON' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, scores: [], error: 'Response is not an object' };
  }

  const record = parsed as Record<string, unknown>;
  if (!('scores' in record)) {
    return { ok: false, scores: [], error: 'Missing scores array' };
  }

  const entries = record['scores'];

  if (!Array.isArray(entries)) {
    return { ok: false, scores: [], error: 'scores must be an array' };
  }

  const scores: ParsedJudgeOutput['scores'] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, scores: [], error: 'Invalid score entry' };
    }
    const row = entry as JudgeScoreEntry;
    if (typeof row.criterionId !== 'string' || !row.criterionId.trim()) {
      return { ok: false, scores: [], error: 'Score entry missing criterionId' };
    }
    const points = Number(row.points);
    if (!Number.isFinite(points)) {
      return { ok: false, scores: [], error: `Non-numeric points for ${row.criterionId}` };
    }
    scores.push({
      criterionId: row.criterionId,
      points,
      ...(readNotes(row.notes) ? { notes: readNotes(row.notes) } : {}),
    });
  }

  const answerNotes = readNotes(record['answerNotes']) ?? readNotes(record['notes']);
  return {
    ok: true,
    scores,
    ...(answerNotes ? { answerNotes } : {}),
  };
}

export interface JudgeOutputSample {
  id: string;
  label: string;
  raw: string;
  parses: boolean;
}

export const JUDGE_OUTPUT_SAMPLES: JudgeOutputSample[] = [
  {
    id: 'valid',
    label: 'Valid JSON',
    raw: '{"scores":[{"criterionId":"c1","points":4,"notes":"Clear"},{"criterionId":"c2","points":3}]}',
    parses: true,
  },
  {
    id: 'fenced',
    label: 'Fenced JSON',
    raw: '```json\n{"scores":[{"criterionId":"c1","points":5}]}\n```',
    parses: true,
  },
  {
    id: 'prose',
    label: 'Prose only',
    raw: 'Accuracy looks like a 4 out of 5 because the answer is mostly correct.',
    parses: false,
  },
  {
    id: 'trailing-comma',
    label: 'Trailing comma',
    raw: '{"scores":[{"criterionId":"c1","points":4,},]}',
    parses: false,
  },
];
