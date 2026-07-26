/** One-dimensional quadratic bowl: loss = (w - target)^2 for teaching step size. */
export const LEARNING_RATE_TARGET = 2;

export type LearningRateChoice = 'tiny' | 'medium' | 'huge';

export const LEARNING_RATE_VALUES: Record<LearningRateChoice, number> = {
  tiny: 0.05,
  medium: 0.4,
  huge: 1.8,
};

export function lossAt(weight: number): number {
  const error = weight - LEARNING_RATE_TARGET;
  return error * error;
}

/** Gradient of (w - target)^2 is 2(w - target). */
export function gradientAt(weight: number): number {
  return 2 * (weight - LEARNING_RATE_TARGET);
}

export function stepWeight(weight: number, rate: LearningRateChoice): number {
  return weight - LEARNING_RATE_VALUES[rate] * gradientAt(weight);
}

export function runSteps(
  start: number,
  rate: LearningRateChoice,
  steps: number,
): { weights: number[]; losses: number[] } {
  const weights: number[] = [start];
  const losses: number[] = [lossAt(start)];
  let w = start;
  for (let i = 0; i < steps; i++) {
    w = stepWeight(w, rate);
    weights.push(w);
    losses.push(lossAt(w));
  }
  return { weights, losses };
}

/** Solved when medium rate reaches low loss and huge rate ends worse than medium. */
export function isLearningRateLabSolved(
  mediumFinalLoss: number,
  hugeFinalLoss: number,
): boolean {
  return mediumFinalLoss < 0.15 && hugeFinalLoss > mediumFinalLoss;
}
