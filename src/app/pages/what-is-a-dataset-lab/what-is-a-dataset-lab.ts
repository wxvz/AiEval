import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';

interface XorCorner {
  input: [number, number];
  target: 0 | 1;
  why: string;
}

const XOR_CORNERS: XorCorner[] = [
  { input: [0, 0], target: 0, why: 'Inputs match, so XOR outputs 0.' },
  { input: [0, 1], target: 1, why: 'Inputs differ, so XOR outputs 1.' },
  { input: [1, 0], target: 1, why: 'Inputs differ, so XOR outputs 1.' },
  { input: [1, 1], target: 0, why: 'Inputs match, so XOR outputs 0.' },
];

@Component({
  selector: 'app-what-is-a-dataset-lab',
  imports: [RouterLink, LearnTermHint, LearnLabNav, PageShell],
  templateUrl: './what-is-a-dataset-lab.html',
  styleUrl: './what-is-a-dataset-lab.css',
})
export class WhatIsADatasetLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('what-is-a-dataset-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly corners = XOR_CORNERS;

  readonly openTermId = signal<string | null>(null);
  readonly labels = signal<(0 | 1 | null)[]>([null, null, null, null]);
  readonly checked = signal(false);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('what-is-a-dataset-lab');
  });

  readonly allLabeled = computed(() => this.labels().every((label) => label !== null));

  readonly correctCount = computed(
    () => this.labels().filter((label, index) => label === this.corners[index]!.target).length,
  );

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  setLabel(index: number, value: 0 | 1): void {
    this.labels.update((labels) => labels.map((label, i) => (i === index ? value : label)));
    this.checked.set(false);
  }

  isCorrect(index: number): boolean {
    return this.labels()[index] === this.corners[index]!.target;
  }

  check(): void {
    if (this.allLabeled()) {
      this.checked.set(true);
    }
  }

  reset(): void {
    this.labels.set([null, null, null, null]);
    this.checked.set(false);
  }

  markLabComplete(): void {
    this.progress.markComplete('what-is-a-dataset-lab');
  }
}
