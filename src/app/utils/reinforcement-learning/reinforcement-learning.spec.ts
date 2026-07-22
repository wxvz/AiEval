import { describe, expect, it } from 'vitest';

import {
  TARGET_POLICY_ARM,
  applyPull,
  emptyStats,
  empiricalBestArm,
  hasExploredBoth,
  isSolved,
  pullArm,
  sampleReward,
} from './reinforcement-learning';

describe('reinforcement-learning engine', () => {
  it('samples known café as a constant reward', () => {
    expect(sampleReward('known')).toBe(2);
  });

  it('samples new café as 1 or 5', () => {
    expect(sampleReward('new', () => 0.1)).toBe(1);
    expect(sampleReward('new', () => 0.9)).toBe(5);
  });

  it('updates arm stats after pulls', () => {
    let stats = emptyStats();
    stats = applyPull(stats, pullArm('known'));
    stats = applyPull(stats, { armId: 'new', reward: 5 });
    expect(stats.known.pulls).toBe(1);
    expect(stats.known.mean).toBe(2);
    expect(stats.new.mean).toBe(5);
  });

  it('requires two pulls per arm before exploration is complete', () => {
    let stats = emptyStats();
    stats = applyPull(stats, { armId: 'known', reward: 2 });
    stats = applyPull(stats, { armId: 'new', reward: 5 });
    expect(hasExploredBoth(stats)).toBe(false);
    stats = applyPull(stats, { armId: 'known', reward: 2 });
    stats = applyPull(stats, { armId: 'new', reward: 1 });
    expect(hasExploredBoth(stats)).toBe(true);
  });

  it('picks the empirical best arm', () => {
    let stats = emptyStats();
    stats = applyPull(stats, { armId: 'known', reward: 2 });
    stats = applyPull(stats, { armId: 'known', reward: 2 });
    stats = applyPull(stats, { armId: 'new', reward: 5 });
    stats = applyPull(stats, { armId: 'new', reward: 5 });
    expect(empiricalBestArm(stats)).toBe('new');
  });

  it('solves when exploration is done and policy locks the better arm', () => {
    let stats = emptyStats();
    for (let i = 0; i < 2; i++) {
      stats = applyPull(stats, { armId: 'known', reward: 2 });
      stats = applyPull(stats, { armId: 'new', reward: 5 });
    }
    expect(isSolved(stats, null)).toBe(false);
    expect(isSolved(stats, 'known')).toBe(false);
    expect(isSolved(stats, TARGET_POLICY_ARM)).toBe(true);
  });
});
