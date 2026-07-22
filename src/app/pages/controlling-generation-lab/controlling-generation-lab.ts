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
  simulateRuns,
  TEACHING_SUMMARY_PROMPT,
  uniqueVariantCount,
} from '../../utils/generation/sample-variance';

@Component({
  selector: 'app-controlling-generation-lab',
  imports: [DecimalPipe, FormsModule, RouterLink, LearnTermHint, LearnLabNav, PageShell],
  templateUrl: './controlling-generation-lab.html',
  styleUrl: './controlling-generation-lab.css',
})
export class ControllingGenerationLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('controlling-generation-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly teachingPrompt = TEACHING_SUMMARY_PROMPT;

  readonly temperature = signal(0);
  readonly openTermId = signal<string | null>(null);
  readonly runs = signal<ReturnType<typeof simulateRuns>>([]);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('controlling-generation-lab');
  });

  readonly uniqueCount = computed(() => uniqueVariantCount(this.runs()));

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  generateRuns(): void {
    this.runs.set(simulateRuns(this.temperature(), 5, 42));
  }

  markLabComplete(): void {
    this.progress.markComplete('controlling-generation-lab');
  }
}
