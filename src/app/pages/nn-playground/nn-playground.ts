import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NnTermHint } from '../../components/nn-term-hint/nn-term-hint';
import { getLesson, getHubLessonsForTrack, getTrack } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { ActivationName, ElementwiseActivationName } from '../../utils/nn/activations';
import {
  CustomRow,
  EntryStyle,
  argmax,
  customDatasetValidationMessage,
  parseClassField,
  parseField,
  sigmoidTargetWarning,
  toDataset,
  usesRegressionDisplay,
} from '../../utils/nn/dataset-validation';
import { AND_DATASET, THREE_CLASS_DATASET, XOR_DATASET } from '../../utils/nn/datasets';
import { NeuralNetwork, TrainSample, TrainStepResult } from '../../utils/nn/network';

export type DatasetName = 'xor' | 'and' | 'three-class' | 'custom';
export type HiddenActivationChoice = ElementwiseActivationName;
export type OutputActivationChoice = 'sigmoid' | 'linear' | 'softmax';

export interface PredictionRow {
  input: number[];
  outputDisplay: string;
  targetDisplay: string;
  correct?: boolean;
  error?: number;
}

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

interface TrainingPlotPoint {
  key: string;
  x: number;
  y: number;
  fill: string;
  stroke: string;
  radius: number;
}

function xorToCustomRows(): CustomRow[] {
  return XOR_DATASET.map(({ input, target }) => ({
    x1: input[0],
    x2: input[1],
    y: target[0],
  }));
}

function threeClassToCustomRows(): CustomRow[] {
  return THREE_CLASS_DATASET.map(({ input, target }) => ({
    x1: input[0],
    x2: input[1],
    y: argmax(target),
  }));
}

@Component({
  selector: 'app-nn-playground',
  imports: [FormsModule, DecimalPipe, NnTermHint, RouterLink],
  templateUrl: './nn-playground.html',
  styleUrl: './nn-playground.css',
})
export class NnPlaygroundPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('neural-network-lab');
  readonly prereqMeta = getLesson(this.labMeta?.prerequisites[0] ?? '');
  readonly trackLabel = getTrack('foundation')?.title ?? 'Foundation';
  readonly trackLabCount = getHubLessonsForTrack('foundation').filter((lesson) => lesson.status === 'live').length;
  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('neural-network-lab');
  });

  readonly hiddenSize = signal(4);
  readonly learningRate = signal(0.5);
  readonly hiddenActivation = signal<HiddenActivationChoice>('sigmoid');
  readonly datasetName = signal<DatasetName>('xor');
  readonly entryStyle = signal<EntryStyle>('binary');
  readonly outputActivation = signal<OutputActivationChoice>('sigmoid');
  readonly customSamples = signal<CustomRow[]>(xorToCustomRows());
  readonly probeInput = signal({ x1: 0, x2: 0 });
  readonly openTermId = signal<string | null>(null);
  readonly lossHistory = signal<number[]>([]);
  readonly lastStep = signal<TrainStepResult | null>(null);
  readonly isTraining = signal(false);
  private readonly weightRevision = signal(0);

  readonly usesSoftmax = computed(() => this.outputActivation() === 'softmax');
  readonly outputSize = computed(() => (this.usesSoftmax() ? 3 : 1));
  readonly isCustom = computed(() => this.datasetName() === 'custom');
  readonly showEntryStyle = computed(() => this.isCustom());

  readonly dataset = computed<TrainSample[]>(() => {
    const name = this.datasetName();
    if (name === 'xor') {
      return XOR_DATASET;
    }
    if (name === 'and') {
      return AND_DATASET;
    }
    if (name === 'three-class') {
      return THREE_CLASS_DATASET;
    }
    return toDataset(this.customSamples(), this.outputActivation());
  });

  readonly validationMessage = computed(() =>
    this.isCustom()
      ? customDatasetValidationMessage(this.customSamples(), this.outputActivation())
      : null,
  );

  readonly sigmoidWarning = computed(() => {
    if (!this.isCustom() || this.outputActivation() !== 'sigmoid') {
      return null;
    }
    return sigmoidTargetWarning(this.customSamples(), this.outputActivation());
  });

  readonly trainingAllowed = computed(() =>
    this.isCustom() ? this.validationMessage() === null : true,
  );

  readonly canTrain = computed(() => !this.isTraining() && this.trainingAllowed());

  readonly usesRegression = computed(() => {
    if (this.usesSoftmax()) {
      return false;
    }
    return usesRegressionDisplay(this.dataset().map(({ target }) => target[0]));
  });

  readonly predictions = computed((): PredictionRow[] => {
    this.weightRevision();
    const softmax = this.usesSoftmax();
    return this.dataset().map(({ input, target }) => {
      const outputVec = this.net.forward(input);
      if (softmax) {
        const predClass = argmax(outputVec);
        const targetClass = argmax(target);
        const probs = outputVec.map((p) => p.toFixed(3)).join(', ');
        return {
          input,
          outputDisplay: `class ${predClass} [${probs}]`,
          targetDisplay: `class ${targetClass}`,
          correct: predClass === targetClass,
        };
      }
      const targetValue = target[0];
      const output = outputVec[0];
      const error = Math.abs(output - targetValue);
      const correct = (output > 0.5) === (targetValue > 0.5);
      return {
        input,
        outputDisplay: output.toFixed(3),
        targetDisplay: String(targetValue),
        error,
        correct,
      };
    });
  });

  readonly probeOutputDisplay = computed(() => {
    this.weightRevision();
    const { x1, x2 } = this.probeInput();
    const outputVec = this.net.forward([x1, x2]);
    if (this.usesSoftmax()) {
      const predClass = argmax(outputVec);
      const top = outputVec[predClass];
      return `class ${predClass} (p=${top.toFixed(4)})`;
    }
    return outputVec[0].toFixed(4);
  });

  readonly plotDomain = computed((): PlotDomain => {
    if (this.isCustom()) {
      const rows = this.customSamples();
      const xs = rows.map((row) => row.x1);
      const ys = rows.map((row) => row.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const padX = Math.max(0.15, (maxX - minX) * 0.2 || 0.25);
      const padY = Math.max(0.15, (maxY - minY) * 0.2 || 0.25);
      return {
        minX: minX - padX,
        maxX: maxX + padX,
        minY: minY - padY,
        maxY: maxY + padY,
      };
    }
    return { minX: -0.08, maxX: 1.08, minY: -0.08, maxY: 1.08 };
  });

  readonly decisionCells = computed((): DecisionCell[] => {
    this.weightRevision();
    const domain = this.plotDomain();
    const gridSize = 14;
    const spanX = domain.maxX - domain.minX;
    const spanY = domain.maxY - domain.minY;
    const cellW = spanX / gridSize;
    const cellH = spanY / gridSize;
    const softmax = this.usesSoftmax();
    const cells: DecisionCell[] = [];

    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const xLeft = domain.minX + col * cellW;
        const xRight = domain.minX + (col + 1) * cellW;
        const yTop = domain.maxY - row * cellH;
        const yBottom = domain.maxY - (row + 1) * cellH;
        const centerX = (xLeft + xRight) / 2;
        const centerY = (yTop + yBottom) / 2;
        const outputVec = this.net.forward([centerX, centerY]);
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
          fill: softmax
            ? this.softmaxCellColor(argmax(outputVec))
            : this.binaryCellColor(outputVec[0]),
        });
      }
    }
    return cells;
  });

  readonly trainingPlotPoints = computed((): TrainingPlotPoint[] => {
    const domain = this.plotDomain();
    const softmax = this.usesSoftmax();
    return this.dataset().map(({ input, target }, index) => {
      const classIndex = softmax ? argmax(target) : target[0] > 0.5 ? 1 : 0;
      const palette = softmax
        ? ['var(--bs-success)', 'var(--bs-primary)', 'var(--bs-warning)']
        : ['var(--bs-secondary)', 'var(--bs-primary)'];
      const fill = palette[classIndex % palette.length] ?? 'var(--bs-primary)';
      return {
        key: `point-${index}`,
        x: this.plotX(input[0], domain),
        y: this.plotY(input[1], domain),
        fill,
        stroke: 'var(--bs-body-bg)',
        radius: 5,
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

  readonly lossChartMax = computed(() => {
    const history = this.lossHistory();
    return history.length > 0 ? Math.max(...history, 0.001) : 0;
  });

  private net = this.createNetwork();

  stepOnce(): void {
    if (!this.trainingAllowed()) {
      return;
    }
    const result = this.net.trainEpoch(this.dataset());
    this.lastStep.set(result.lastStep);
    this.lossHistory.update((history) => [...history.slice(-199), result.avgLoss]);
    this.weightRevision.update((n) => n + 1);
  }

  async train(steps = 100): Promise<void> {
    if (!this.canTrain()) {
      return;
    }
    this.isTraining.set(true);
    for (let i = 0; i < steps; i++) {
      this.stepOnce();
      if (i % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    this.isTraining.set(false);
  }

  resetNetwork(): void {
    this.isTraining.set(false);
    this.rebuildNetwork();
    this.lossHistory.set([]);
    this.lastStep.set(null);
  }

  onArchitectureChange(): void {
    if (this.isTraining()) {
      return;
    }
    this.rebuildNetwork();
    this.lossHistory.set([]);
    this.lastStep.set(null);
  }

  onHiddenActivationChange(value: HiddenActivationChoice): void {
    this.hiddenActivation.set(value);
    this.onArchitectureChange();
  }

  onDatasetChange(name: DatasetName): void {
    if (name === 'custom' && this.customSamples().length === 0) {
      this.customSamples.set(
        this.usesSoftmax() ? threeClassToCustomRows() : xorToCustomRows(),
      );
    }
    this.datasetName.set(name);
    this.onArchitectureChange();
  }

  onOutputActivationChange(value: OutputActivationChoice): void {
    this.outputActivation.set(value);
    if (value === 'softmax' && (this.datasetName() === 'xor' || this.datasetName() === 'and')) {
      this.datasetName.set('three-class');
    }
    if (value !== 'softmax' && this.datasetName() === 'three-class') {
      this.datasetName.set('xor');
    }
    if (value === 'softmax' && this.isCustom()) {
      this.customSamples.update((rows) =>
        rows.map((row) => ({ ...row, y: Math.min(2, Math.max(0, Math.round(row.y))) })),
      );
    }
    this.onArchitectureChange();
  }

  onEntryStyleChange(style: EntryStyle): void {
    this.entryStyle.set(style);
    const softmax = this.usesSoftmax();
    if (style === 'binary') {
      this.customSamples.update((rows) =>
        rows.map((row) => ({
          x1: parseField(row.x1, 'binary'),
          x2: parseField(row.x2, 'binary'),
          y: softmax
            ? parseClassField(row.y, 'binary')
            : parseField(row.y, 'binary'),
        })),
      );
      this.probeInput.update((probe) => ({
        x1: parseField(probe.x1, 'binary'),
        x2: parseField(probe.x2, 'binary'),
      }));
    }
  }

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  addCustomRow(): void {
    this.customSamples.update((rows) => [...rows, { x1: 0, x2: 0, y: 0 }]);
  }

  removeCustomRow(index: number): void {
    this.customSamples.update((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  }

  updateCustomRow(index: number, field: keyof CustomRow, raw: string | number): void {
    const style = this.entryStyle();
    const parsed =
      field === 'y' && this.usesSoftmax()
        ? parseClassField(raw, style)
        : parseField(raw, style);
    this.customSamples.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: parsed } : row)),
    );
  }

  updateProbeField(field: 'x1' | 'x2', raw: string | number): void {
    const parsed = parseField(raw, this.entryStyle());
    this.probeInput.update((probe) => ({ ...probe, [field]: parsed }));
  }

  private rebuildNetwork(): void {
    this.net = this.createNetwork();
    this.weightRevision.update((n) => n + 1);
  }

  private createNetwork(): NeuralNetwork {
    const outputActivation: ActivationName = this.outputActivation();
    return new NeuralNetwork({
      layerSizes: [2, this.hiddenSize(), this.outputSize()],
      hiddenActivation: this.hiddenActivation(),
      outputActivation,
      learningRate: this.learningRate(),
    });
  }

  markLabComplete(): void {
    this.progress.markComplete('neural-network-lab');
  }

  plotX(value: number, domain: PlotDomain = this.plotDomain()): number {
    const span = domain.maxX - domain.minX || 1;
    return 20 + ((value - domain.minX) / span) * 160;
  }

  plotY(value: number, domain: PlotDomain = this.plotDomain()): number {
    const span = domain.maxY - domain.minY || 1;
    return 180 - ((value - domain.minY) / span) * 160;
  }

  private binaryCellColor(output: number): string {
    return output > 0.5 ? 'var(--bs-primary)' : 'var(--bs-secondary)';
  }

  private softmaxCellColor(classIndex: number): string {
    const colors = ['var(--bs-success)', 'var(--bs-primary)', 'var(--bs-warning)'];
    return colors[classIndex % colors.length] ?? 'var(--bs-secondary)';
  }
}
