import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  BANDIT_ARMS,
  type BanditArmId,
  type PullResult,
  applyPull,
  emptyStats,
  hasExploredBoth,
  isSolved,
  pullArm,
} from '../../utils/reinforcement-learning/reinforcement-learning';

@Component({
  selector: 'app-reinforcement-learning-lab',
  imports: [DecimalPipe, RouterLink, LearnTermHint, LearnLabNav, PageShell],
  templateUrl: './reinforcement-learning-lab.html',
  styleUrl: './reinforcement-learning-lab.css',
})
export class ReinforcementLearningLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('reinforcement-learning-lab');
  readonly prereqMeta = getLesson(this.labMeta?.prerequisites[0] ?? '');
  readonly arms = BANDIT_ARMS;

  readonly openTermId = signal<string | null>(null);
  readonly stats = signal(emptyStats());
  readonly history = signal<PullResult[]>([]);
  readonly lockedPolicy = signal<BanditArmId | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('reinforcement-learning-lab');
  });

  readonly explored = computed(() => hasExploredBoth(this.stats()));

  readonly solved = computed(() => isSolved(this.stats(), this.lockedPolicy()));

  readonly totalReward = computed(() =>
    this.history().reduce((sum, pull) => sum + pull.reward, 0),
  );

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  pull(armId: BanditArmId): void {
    const result = pullArm(armId);
    this.stats.update((current) => applyPull(current, result));
    this.history.update((history) => [...history, result]);
  }

  lockPolicy(armId: BanditArmId): void {
    this.lockedPolicy.set(armId);
  }

  reset(): void {
    this.stats.set(emptyStats());
    this.history.set([]);
    this.lockedPolicy.set(null);
  }

  markLabComplete(): void {
    if (!this.solved()) {
      return;
    }
    this.progress.markComplete('reinforcement-learning-lab');
  }
}
