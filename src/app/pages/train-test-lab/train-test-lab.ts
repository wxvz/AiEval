import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnLabLink } from '../../components/learn-lab-link/learn-lab-link';
import { LearnLockedCallout } from '../../components/learn-locked-callout/learn-locked-callout';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { NeuralNetwork } from '../../utils/nn/network';
import {
  SplitRow,
  XOR_SPLIT_ROWS,
  accuracy,
  predictRow,
  rowsForRole,
  splitRows,
} from '../../utils/nn/train-test-split';

interface PlotDomain {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface DecisionCell {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}

interface PlotPoint {
  key: string;
  x: number;
  y: number;
  fill: string;
  stroke: string;
  radius: number;
}

interface TableRow {
  row: SplitRow;
  output: number;
  predicted: number;
  correct: boolean;
}

const PLOT_DOMAIN: PlotDomain = { minX: -0.08, maxX: 1.08, minY: -0.08, maxY: 1.08 };

@Component({
  selector: 'app-train-test-lab',
  imports: [FormsModule, DecimalPipe, RouterLink, LearnTermHint, LearnLabNav, PageShell, LearnLockedCallout, LearnLabLink],
  templateUrl: './train-test-lab.html',
  styleUrl: './train-test-lab.css',
})
export class TrainTestLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('train-vs-test-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly testOptions = XOR_SPLIT_ROWS;

  readonly testId = signal('11');
  readonly openTermId = signal<string | null>(null);
  private readonly weightRevision = signal(0);
  private net = this.createNetwork();

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('train-vs-test-lab');
  });

  readonly rows = computed(() => splitRows(this.testId()));

  readonly tableRows = computed((): TableRow[] => {
    this.weightRevision();
    return this.rows().map((row) => {
      const prediction = predictRow(row, this.net);
      return { row, ...prediction };
    });
  });

  readonly trainAccuracy = computed(() => {
    this.weightRevision();
    return accuracy(rowsForRole(this.rows(), 'train'), this.net);
  });

  readonly testAccuracy = computed(() => {
    this.weightRevision();
    return accuracy(rowsForRole(this.rows(), 'test'), this.net);
  });

  readonly decisionCells = computed((): DecisionCell[] => {
    this.weightRevision();
    const gridSize = 14;
    const domain = PLOT_DOMAIN;
    const spanX = domain.maxX - domain.minX;
    const spanY = domain.maxY - domain.minY;
    const cellW = spanX / gridSize;
    const cellH = spanY / gridSize;
    const cells: DecisionCell[] = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const xLeft = domain.minX + col * cellW;
        const xRight = domain.minX + (col + 1) * cellW;
        const yTop = domain.maxY - row * cellH;
        const yBottom = domain.maxY - (row + 1) * cellH;
        const centerX = (xLeft + xRight) / 2;
        const centerY = (yTop + yBottom) / 2;
        const output = this.net.forward([centerX, centerY])[0];
        const svgX = this.plotX(xLeft, domain);
        const svgY = this.plotY(yTop, domain);
        const svgW = this.plotX(xRight, domain) - svgX;
        const svgH = this.plotY(yBottom, domain) - svgY;
        cells.push({
          key: `${row}-${col}`,
          x: svgX,
          y: svgY,
          width: Math.max(svgW, 1),
          height: Math.max(svgH, 1),
          fill: output > 0.5 ? 'var(--bs-primary)' : 'var(--bs-secondary)',
        });
      }
    }
    return cells;
  });

  readonly plotPoints = computed((): PlotPoint[] => {
    const domain = PLOT_DOMAIN;
    return this.rows().map((row) => ({
      key: row.id,
      x: this.plotX(row.input[0], domain),
      y: this.plotY(row.input[1], domain),
      fill: row.role === 'train' ? 'var(--bs-primary)' : 'var(--bs-warning)',
      stroke: 'var(--bs-body-bg)',
      radius: 5,
    }));
  });

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  onTestIdChange(value: string): void {
    this.testId.set(value);
    this.resetNetwork();
  }

  train(epochs = 200): void {
    const trainSamples = rowsForRole(this.rows(), 'train').map((row) => ({
      input: [...row.input],
      target: [row.target],
    }));
    for (let epoch = 0; epoch < epochs; epoch++) {
      this.net.trainEpoch(trainSamples);
    }
    this.weightRevision.update((n) => n + 1);
  }

  resetNetwork(): void {
    this.net = this.createNetwork();
    this.weightRevision.update((n) => n + 1);
  }

  markLabComplete(): void {
    this.progress.markComplete('train-vs-test-lab');
  }

  plotX(value: number, domain: PlotDomain = PLOT_DOMAIN): number {
    const span = domain.maxX - domain.minX || 1;
    return 20 + ((value - domain.minX) / span) * 160;
  }

  plotY(value: number, domain: PlotDomain = PLOT_DOMAIN): number {
    const span = domain.maxY - domain.minY || 1;
    return 180 - ((value - domain.minY) / span) * 160;
  }

  private createNetwork(): NeuralNetwork {
    return new NeuralNetwork({
      layerSizes: [2, 4, 1],
      hiddenActivation: 'sigmoid',
      outputActivation: 'sigmoid',
      learningRate: 0.5,
    });
  }
}
