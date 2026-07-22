import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  DEFAULT_ATTENTION_WEIGHTS,
  SENTENCE_TOKENS,
  TARGET_RANKING_IDS,
  evaluateAttention,
  isNormalized,
  normalizeAttention,
} from '../../utils/transformers/attention';

@Component({
  selector: 'app-transformers-lab',
  imports: [DecimalPipe, FormsModule, RouterLink, LearnTermHint, LearnLabNav, PageShell],
  templateUrl: './transformers-lab.html',
  styleUrl: './transformers-lab.css',
})
export class TransformersLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('transformers-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly tokens = SENTENCE_TOKENS;
  readonly targetRanking = TARGET_RANKING_IDS;

  readonly rawWeights = signal<number[]>([...DEFAULT_ATTENTION_WEIGHTS]);
  readonly openTermId = signal<string | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('transformers-lab');
  });

  readonly result = computed(() => evaluateAttention(this.rawWeights()));

  readonly needsNormalize = computed(() => !isNormalized(this.rawWeights()));

  readonly weightSum = computed(() =>
    this.rawWeights().reduce((sum, w) => sum + Math.max(0, w), 0),
  );

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  onWeightChange(index: number, value: number): void {
    this.rawWeights.update((weights) => {
      const next = [...weights];
      next[index] = Math.max(0, value);
      return next;
    });
  }

  normalize(): void {
    this.rawWeights.set(normalizeAttention(this.rawWeights()));
  }

  resetWeights(): void {
    this.rawWeights.set([...DEFAULT_ATTENTION_WEIGHTS]);
  }

  markLabComplete(): void {
    this.progress.markComplete('transformers-lab');
  }
}
