export interface AnswerVariant {
  id: string;
  text: string;
  weight: number;
}

export interface SamplingRun {
  variantId: string;
  text: string;
}

const SUMMARY_VARIANTS: AnswerVariant[] = [
  { id: 'canonical', text: 'Three bullets: clear task, stable settings, fair comparison.', weight: 10 },
  { id: 'alt-a', text: 'Summary: lock temperature, fix max tokens, then judge models.', weight: 4 },
  { id: 'alt-b', text: 'Key points — sampling knobs matter before you score answers.', weight: 3 },
  { id: 'alt-c', text: 'Use low temperature for regression; document top-p in notes.', weight: 2 },
];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickVariant(variants: AnswerVariant[], temperature: number, random: () => number): AnswerVariant {
  const clampedTemp = Math.max(0, Math.min(1, temperature));
  if (clampedTemp <= 0.05) {
    return variants.reduce((best, row) => (row.weight > best.weight ? row : best), variants[0]!);
  }

  const adjusted = variants.map((row) => ({
    ...row,
    effectiveWeight: row.weight ** (1 / (0.15 + clampedTemp)),
  }));
  const total = adjusted.reduce((sum, row) => sum + row.effectiveWeight, 0);
  let threshold = random() * total;
  for (const row of adjusted) {
    threshold -= row.effectiveWeight;
    if (threshold <= 0) {
      return row;
    }
  }
  return adjusted[adjusted.length - 1]!;
}

export function simulateRuns(temperature: number, count: number, seed = 42): SamplingRun[] {
  const random = mulberry32(seed);
  const runs: SamplingRun[] = [];
  for (let index = 0; index < count; index++) {
    const variant = pickVariant(SUMMARY_VARIANTS, temperature, random);
    runs.push({ variantId: variant.id, text: variant.text });
  }
  return runs;
}

export function uniqueVariantCount(runs: SamplingRun[]): number {
  return new Set(runs.map((run) => run.variantId)).size;
}

export const TEACHING_SUMMARY_PROMPT =
  'Summarize why generation settings matter before comparing LLM answers.';
