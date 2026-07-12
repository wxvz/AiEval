import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  FAITHFULNESS_ANSWER,
  FAITHFULNESS_CONTEXT,
  classifyAnswerSupport,
  type SupportLabel,
} from '../../utils/faithfulness/support-check';

@Component({
  selector: 'app-faithfulness-lab',
  imports: [RouterLink, LearnTermHint, LearnLabNav, PageShell],
  templateUrl: './faithfulness-lab.html',
  styleUrl: './faithfulness-lab.css',
})
export class FaithfulnessLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('faithfulness-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly context = FAITHFULNESS_CONTEXT;
  readonly answer = FAITHFULNESS_ANSWER;

  readonly openTermId = signal<string | null>(null);
  readonly checked = signal(false);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('faithfulness-lab');
  });

  readonly rows = computed(() => classifyAnswerSupport(this.answer, this.context));

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  reveal(): void {
    this.checked.set(true);
  }

  labelClass(label: SupportLabel): string {
    switch (label) {
      case 'supported':
        return 'text-success';
      case 'unsupported':
        return 'text-danger';
      default:
        return 'text-warning';
    }
  }

  markLabComplete(): void {
    this.progress.markComplete('faithfulness-lab');
  }
}
