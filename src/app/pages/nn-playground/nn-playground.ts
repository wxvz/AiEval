import { DecimalPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { NnTermHint } from '../../components/nn-term-hint/nn-term-hint';
import { ActivationName } from '../../utils/nn/activations';
import {
  CustomRow,
  EntryStyle,
  datasetValidationMessage,
  parseField,
  sigmoidTargetWarning,
  toDataset,
  usesRegressionDisplay,
} from '../../utils/nn/dataset-validation';
import { AND_DATASET, XOR_DATASET } from '../../utils/nn/datasets';
import { NeuralNetwork, TrainSample, TrainStepResult } from '../../utils/nn/network';

export type DatasetName = 'xor' | 'and' | 'custom';
export type OutputActivationChoice = 'sigmoid' | 'linear';

function xorToCustomRows(): CustomRow[] {
  return XOR_DATASET.map(({ input, target }) => ({
    x1: input[0],
    x2: input[1],
    y: target[0],
  }));
}

@Component({
  selector: 'app-nn-playground',
  imports: [FormsModule, DecimalPipe, NnTermHint, RouterLink],
  templateUrl: './nn-playground.html',
  styleUrl: './nn-playground.css',
})
export class NnPlaygroundPage {
  readonly hiddenSize = signal(4);
  readonly learningRate = signal(0.5);
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

  private net = this.createNetwork();

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
    return toDataset(this.customSamples());
  });

  readonly validationMessage = computed(() =>
    this.isCustom() ? datasetValidationMessage(this.customSamples()) : null,
  );

  readonly sigmoidWarning = computed(() => {
    if (!this.isCustom() || this.outputActivation() !== 'sigmoid') {
      return null;
    }
    return sigmoidTargetWarning(this.customSamples());
  });

  readonly trainingAllowed = computed(() =>
    this.isCustom() ? this.validationMessage() === null : true,
  );

  readonly canTrain = computed(() => !this.isTraining() && this.trainingAllowed());

  readonly usesRegression = computed(() =>
    usesRegressionDisplay(this.dataset().map(({ target }) => target[0])),
  );

  readonly predictions = computed(() => {
    this.weightRevision();
    return this.dataset().map(({ input, target }) => {
      const targetValue = target[0];
      const output = this.net.forward(input)[0];
      const error = Math.abs(output - targetValue);
      const correct =
        !this.usesRegression() && (output > 0.5) === (targetValue > 0.5);
      return { input, target: targetValue, output, error, correct };
    });
  });

  readonly probeOutput = computed(() => {
    this.weightRevision();
    const { x1, x2 } = this.probeInput();
    return this.net.forward([x1, x2])[0];
  });

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
    this.rebuildNetwork();
    this.lossHistory.set([]);
    this.lastStep.set(null);
  }

  onArchitectureChange(): void {
    this.rebuildNetwork();
    this.lossHistory.set([]);
    this.lastStep.set(null);
  }

  onDatasetChange(name: DatasetName): void {
    if (name === 'custom' && this.customSamples().length === 0) {
      this.customSamples.set(xorToCustomRows());
    }
    this.datasetName.set(name);
    this.onArchitectureChange();
  }

  onOutputActivationChange(value: OutputActivationChoice): void {
    this.outputActivation.set(value);
    this.onArchitectureChange();
  }

  onEntryStyleChange(style: EntryStyle): void {
    this.entryStyle.set(style);
    if (style === 'binary') {
      this.customSamples.update((rows) =>
        rows.map((row) => ({
          x1: parseField(row.x1, 'binary'),
          x2: parseField(row.x2, 'binary'),
          y: parseField(row.y, 'binary'),
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
    const parsed = parseField(raw, this.entryStyle());
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
      layerSizes: [2, this.hiddenSize(), 1],
      hiddenActivation: 'sigmoid',
      outputActivation,
      learningRate: this.learningRate(),
    });
  }
}
