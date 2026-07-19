/**
 * Two-armed bandit for the Reinforcement learning lab.
 * Pure TypeScript — no Angular imports.
 */

export type BanditArmId = 'known' | 'new';

export interface BanditArm {
  id: BanditArmId;
  label: string;
  /** Deterministic teaching means (sampling may add noise). */
  trueMean: number;
}

export interface PullResult {
  armId: BanditArmId;
  reward: number;
}

export interface ArmStats {
  armId: BanditArmId;
  pulls: number;
  totalReward: number;
  mean: number | null;
}

export const BANDIT_ARMS: readonly BanditArm[] = [
  { id: 'known', label: 'Known café', trueMean: 2 },
  { id: 'new', label: 'New café', trueMean: 3 },
];

/** Better arm by true mean — the policy the learner should lock in. */
export const TARGET_POLICY_ARM: BanditArmId = 'new';

export const MIN_EXPLORE_PULLS_PER_ARM = 2;

/**
 * Sample a reward for an arm.
 * Known café: always 2. New café: 1 or 5 with equal chance (mean 3).
 */
export function sampleReward(
  armId: BanditArmId,
  random: () => number = Math.random,
): number {
  if (armId === 'known') {
    return 2;
  }
  return random() < 0.5 ? 1 : 5;
}

export function pullArm(
  armId: BanditArmId,
  random: () => number = Math.random,
): PullResult {
  return { armId, reward: sampleReward(armId, random) };
}

export function emptyStats(): Record<BanditArmId, ArmStats> {
  return {
    known: { armId: 'known', pulls: 0, totalReward: 0, mean: null },
    new: { armId: 'new', pulls: 0, totalReward: 0, mean: null },
  };
}

export function applyPull(
  stats: Record<BanditArmId, ArmStats>,
  result: PullResult,
): Record<BanditArmId, ArmStats> {
  const current = stats[result.armId];
  const pulls = current.pulls + 1;
  const totalReward = current.totalReward + result.reward;
  return {
    ...stats,
    [result.armId]: {
      armId: result.armId,
      pulls,
      totalReward,
      mean: totalReward / pulls,
    },
  };
}

export function hasExploredBoth(
  stats: Record<BanditArmId, ArmStats>,
  minPulls: number = MIN_EXPLORE_PULLS_PER_ARM,
): boolean {
  return stats.known.pulls >= minPulls && stats.new.pulls >= minPulls;
}

export function empiricalBestArm(
  stats: Record<BanditArmId, ArmStats>,
): BanditArmId | null {
  if (stats.known.pulls === 0 || stats.new.pulls === 0) {
    return null;
  }
  if ((stats.known.mean ?? 0) === (stats.new.mean ?? 0)) {
    return null;
  }
  return (stats.new.mean ?? 0) > (stats.known.mean ?? 0) ? 'new' : 'known';
}

/**
 * Lab success: explore both arms, then lock a policy on the better true arm.
 */
export function isSolved(
  stats: Record<BanditArmId, ArmStats>,
  lockedPolicy: BanditArmId | null,
): boolean {
  return hasExploredBoth(stats) && lockedPolicy === TARGET_POLICY_ARM;
}
