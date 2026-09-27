import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnLabLink } from '../../components/learn-lab-link/learn-lab-link';
import { LearnLockedCallout } from '../../components/learn-locked-callout/learn-locked-callout';
import { NnTermHint } from '../../components/nn-term-hint/nn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  TARGET_BIAS,
  TARGET_WEIGHT,
  evaluateRows,
  isSolved,
} from '../../utils/bias-weights/bias-weights';

@Component({
  selector: 'app-bias-weights-lab',
  imports: [FormsModule, DecimalPipe, RouterLink, NnTermHint, LearnLabNav, LearnLockedCallout, PageShell, LearnLabLink],
  templateUrl: './bias-weights-lab.html',
  styleUrl: './bias-weights-lab.css',
})
export class BiasWeightsLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('bias-and-weights-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');

  readonly weight = signal(0);
  readonly bias = signal(0);
  readonly openTermId = signal<string | null>(null);

  readonly tipWeight = TARGET_WEIGHT;
  readonly tipBias = TARGET_BIAS;

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('bias-and-weights-lab');
  });

  readonly rows = computed(() => evaluateRows(this.weight(), this.bias()));

  readonly solved = computed(() => isSolved(this.weight(), this.bias()));

  /** Simple SVG polyline of prediction vs x (viewBox 0 0 200 120). */
  readonly predictionPolyline = computed(() => {
    const rows = this.rows();
    const left = 20;
    const top = 10;
    const width = 160;
    const height = 90;
    return rows
      .map((row) => {
        const x = left + row.x * width;
        const y = top + height - row.prediction * height;
        return `${x},${y}`;
      })
      .join(' ');
  });

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  onWeightChange(value: number): void {
    this.weight.set(value);
  }

  onBiasChange(value: number): void {
    this.bias.set(value);
  }

  resetParams(): void {
    this.weight.set(0);
    this.bias.set(0);
  }

  applyTip(): void {
    this.weight.set(TARGET_WEIGHT);
    this.bias.set(TARGET_BIAS);
  }

  markLabComplete(): void {
    if (!this.solved()) {
      return;
    }
    this.progress.markComplete('bias-and-weights-lab');
  }
}
