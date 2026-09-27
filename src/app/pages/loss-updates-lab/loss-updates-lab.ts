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
import { XOR_DATASET } from '../../utils/nn/datasets';
import { NeuralNetwork } from '../../utils/nn/network';

interface PredictionRow {
  input: number[];
  output: number;
  target: number;
  error: number;
  correct: boolean;
}

@Component({
  selector: 'app-loss-updates-lab',
  imports: [FormsModule, DecimalPipe, RouterLink, NnTermHint, LearnLabNav, PageShell, LearnLockedCallout, LearnLabLink],
  templateUrl: './loss-updates-lab.html',
  styleUrl: './loss-updates-lab.css',
})
export class LossUpdatesLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('loss-and-updates-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');

  readonly learningRate = signal(0.5);
  readonly openTermId = signal<string | null>(null);
  private readonly weightRevision = signal(0);
  readonly lossHistory = signal<number[]>([]);
  private net = this.createNetwork();

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('loss-and-updates-lab');
  });

  readonly predictions = computed((): PredictionRow[] => {
    this.weightRevision();
    return XOR_DATASET.map(({ input, target }) => {
      const output = this.net.forward(input)[0];
      const targetValue = target[0];
      const error = Math.abs(output - targetValue);
      return {
        input,
        output,
        target: targetValue,
        error,
        correct: (output > 0.5) === (targetValue > 0.5),
      };
    });
  });

  readonly lossPolyline = computed(() => {
    const history = this.lossHistory();
    if (history.length < 2) {
      return '';
    }
    const maxLoss = Math.max(...history, 0.001);
    const width = 160;
    const height = 90;
    const left = 20;
    const top = 10;
    return history
      .map((loss, index) => {
        const x = left + (index / (history.length - 1)) * width;
        const y = top + height - (loss / maxLoss) * height;
        return `${x},${y}`;
      })
      .join(' ');
  });

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  onLearningRateChange(value: number): void {
    this.learningRate.set(value);
    this.resetNetwork();
  }

  train(epochs = 1): void {
    for (let epoch = 0; epoch < epochs; epoch++) {
      const result = this.net.trainEpoch(XOR_DATASET);
      this.lossHistory.update((history) => [...history.slice(-199), result.avgLoss]);
    }
    this.weightRevision.update((n) => n + 1);
  }

  resetNetwork(): void {
    this.net = this.createNetwork();
    this.lossHistory.set([]);
    this.weightRevision.update((n) => n + 1);
  }

  markLabComplete(): void {
    this.progress.markComplete('loss-and-updates-lab');
  }

  private createNetwork(): NeuralNetwork {
    return new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'sigmoid',
      outputActivation: 'sigmoid',
      learningRate: this.learningRate(),
    });
  }
}
