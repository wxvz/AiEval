import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  JUDGE_OUTPUT_SAMPLES,
  parseJudgeOutput,
} from '../../utils/judge-output/parse-judge-scores';

@Component({
  selector: 'app-judge-json-lab',
  imports: [RouterLink, LearnTermHint, LearnLabNav, PageShell],
  templateUrl: './judge-json-lab.html',
  styleUrl: './judge-json-lab.css',
})
export class JudgeJsonLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('judge-json-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly samples = JUDGE_OUTPUT_SAMPLES;

  readonly selectedId = signal<string | null>(null);
  readonly openTermId = signal<string | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('judge-json-lab');
  });

  readonly selectedSample = computed(() =>
    this.samples.find((sample) => sample.id === this.selectedId()) ?? null,
  );

  readonly parseResult = computed(() => {
    const sample = this.selectedSample();
    if (!sample) {
      return null;
    }
    return parseJudgeOutput(sample.raw);
  });

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  selectSample(id: string): void {
    this.selectedId.set(id);
  }

  markLabComplete(): void {
    this.progress.markComplete('judge-json-lab');
  }
}
