import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { NnTermHint } from '../../components/nn-term-hint/nn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  LEARNING_RATE_VALUES,
  type LearningRateChoice,
  isLearningRateLabSolved,
  runSteps,
} from '../../utils/learning-rate-lab/learning-rate-lab';

@Component({
  selector: 'app-learning-rate-lab',
  imports: [DecimalPipe, RouterLink, NnTermHint, LearnLabNav, PageShell],
  templateUrl: './learning-rate-lab.html',
  styleUrl: './learning-rate-lab.css',
})
export class LearningRateLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('learning-rate-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly rates: LearningRateChoice[] = ['tiny', 'medium', 'huge'];
  readonly rateValues = LEARNING_RATE_VALUES;

  readonly selected = signal<LearningRateChoice>('medium');
  /** Rates the learner has explicitly selected (not just the default view). */
  readonly inspectedRates = signal<ReadonlySet<LearningRateChoice>>(new Set());
  readonly openTermId = signal<string | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('learning-rate-lab');
  });

  readonly trajectory = computed(() => runSteps(0, this.selected(), 8));

  readonly comparisons = computed(() => {
    const medium = runSteps(0, 'medium', 8);
    const huge = runSteps(0, 'huge', 8);
    return {
      mediumFinal: medium.losses[medium.losses.length - 1]!,
      hugeFinal: huge.losses[huge.losses.length - 1]!,
    };
  });

  readonly solved = computed(() => {
    const inspected = this.inspectedRates();
    // Require comparing medium vs huge before showing success (default view alone is not enough).
    if (!inspected.has('medium') || !inspected.has('huge')) {
      return false;
    }
    const { mediumFinal, hugeFinal } = this.comparisons();
    return isLearningRateLabSolved(mediumFinal, hugeFinal);
  });

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  selectRate(rate: LearningRateChoice): void {
    this.selected.set(rate);
    this.inspectedRates.update((prev) => new Set([...prev, rate]));
  }

  markLabComplete(): void {
    if (!this.solved()) {
      return;
    }
    this.progress.markComplete('learning-rate-lab');
  }
}
