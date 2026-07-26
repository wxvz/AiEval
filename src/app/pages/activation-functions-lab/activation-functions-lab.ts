import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { NnTermHint } from '../../components/nn-term-hint/nn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  LAB_ACTIVATIONS,
  type LabActivationName,
  activate,
  activationLabel,
  evaluateProbes,
  isSolved,
  sampleCurve,
} from '../../utils/activation-functions/activation-functions';

@Component({
  selector: 'app-activation-functions-lab',
  imports: [DecimalPipe, RouterLink, NnTermHint, LearnLabNav, PageShell],
  templateUrl: './activation-functions-lab.html',
  styleUrl: './activation-functions-lab.css',
})
export class ActivationFunctionsLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('activation-functions-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly activations = LAB_ACTIVATIONS;
  readonly activationLabel = activationLabel;

  readonly selected = signal<LabActivationName>('linear');
  readonly openTermId = signal<string | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('activation-functions-lab');
  });

  readonly rows = computed(() => evaluateProbes(this.selected()));

  readonly solved = computed(() => isSolved(this.selected()));

  /** SVG polyline of the selected activation (viewBox 0 0 200 120). */
  readonly curvePolyline = computed(() => {
    const points = sampleCurve(this.selected(), -3, 3, 49);
    const left = 20;
    const top = 10;
    const width = 160;
    const height = 90;
    const zMin = -3;
    const zMax = 3;
    const yMin = -1.5;
    const yMax = 1.5;
    return points
      .map((point) => {
        const x = left + ((point.z - zMin) / (zMax - zMin)) * width;
        const clampedY = Math.min(yMax, Math.max(yMin, point.y));
        const y = top + height - ((clampedY - yMin) / (yMax - yMin)) * height;
        return `${x},${y}`;
      })
      .join(' ');
  });

  readonly probeOutput = computed(() => activate(this.selected(), 0));

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  selectActivation(name: LabActivationName): void {
    this.selected.set(name);
  }

  markLabComplete(): void {
    if (!this.solved()) {
      return;
    }
    this.progress.markComplete('activation-functions-lab');
  }
}
