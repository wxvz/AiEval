import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { NnTermHint } from '../../components/nn-term-hint/nn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  DEFAULT_SOFTMAX_SCORES,
  SOFTMAX_LABELS,
  type SoftmaxLabScores,
  clampScore,
  isSoftmaxLabSolved,
  probabilitiesFromScores,
} from '../../utils/softmax-lab/softmax-lab';

@Component({
  selector: 'app-softmax-lab',
  imports: [DecimalPipe, FormsModule, RouterLink, NnTermHint, LearnLabNav, PageShell],
  templateUrl: './softmax-lab.html',
  styleUrl: './softmax-lab.css',
})
export class SoftmaxLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('softmax-and-distributions-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly labels = SOFTMAX_LABELS;

  readonly scores = signal<SoftmaxLabScores>([...DEFAULT_SOFTMAX_SCORES]);
  readonly openTermId = signal<string | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('softmax-and-distributions-lab');
  });

  readonly probabilities = computed(() => probabilitiesFromScores(this.scores()));

  readonly solved = computed(() => isSoftmaxLabSolved(this.scores()));

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  setScore(index: number, raw: number | string): void {
    const next: SoftmaxLabScores = [...this.scores()];
    next[index] = clampScore(Number(raw));
    this.scores.set(next);
  }

  markLabComplete(): void {
    if (!this.solved()) {
      return;
    }
    this.progress.markComplete('softmax-and-distributions-lab');
  }
}
