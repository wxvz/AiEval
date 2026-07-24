import { softmaxForward } from '../nn/activations';

export type SoftmaxLabScores = [number, number, number];

export const SOFTMAX_LABELS = ['Cat', 'Dog', 'Bird'] as const;

/** Default logits that are close but not uniform. */
export const DEFAULT_SOFTMAX_SCORES: SoftmaxLabScores = [1.2, 0.8, 0.3];

export function probabilitiesFromScores(scores: SoftmaxLabScores): number[] {
  return softmaxForward([...scores]);
}

/** True when the largest probability is on Dog (index 1) and exceeds 0.45. */
export function isSoftmaxLabSolved(scores: SoftmaxLabScores): boolean {
  const probs = probabilitiesFromScores(scores);
  const dog = probs[1] ?? 0;
  const max = Math.max(...probs);
  return dog === max && dog >= 0.45;
}

export function clampScore(value: number): number {
  return Math.min(3, Math.max(-3, value));
}
