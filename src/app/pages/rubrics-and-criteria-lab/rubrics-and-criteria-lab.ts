import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnLockedCallout } from '../../components/learn-locked-callout/learn-locked-callout';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';

interface RubricRow {
  id: string;
  label: string;
  anchorLow: string;
  anchorHigh: string;
  reference: number;
  rationale: string;
}

const LAB_PROMPT = 'Summarize our refund policy for a customer in two sentences.';

const LAB_ANSWER =
  'You can request a refund within 30 days of purchase as long as the item is unused. Contact support with your ' +
  'order number and the refund is processed to your original payment method within 5 business days; note that ' +
  'digital downloads are final sale.';

const RUBRIC: RubricRow[] = [
  {
    id: 'accuracy',
    label: 'Accuracy',
    anchorLow: '1: invents policy details',
    anchorHigh: '5: every claim matches the policy',
    reference: 5,
    rationale: 'All stated details (30 days, unused, 5 business days, digital final sale) match the policy.',
  },
  {
    id: 'brevity',
    label: 'Follows length instruction',
    anchorLow: '1: ignores the two-sentence limit',
    anchorHigh: '5: exactly the requested length',
    reference: 3,
    rationale: 'The prompt asked for two sentences; the answer stretches the second sentence with a trailing note. Middle score: close but not exact.',
  },
  {
    id: 'clarity',
    label: 'Clarity',
    anchorLow: '1: confusing or jargon-heavy',
    anchorHigh: '5: a customer can act immediately',
    reference: 4,
    rationale: 'Plain language and concrete steps; packing three facts into the final sentence costs a point.',
  },
];

/** How far a score can be from the reference and still count as agreeing. */
const SCORE_TOLERANCE = 1;

@Component({
  selector: 'app-rubrics-and-criteria-lab',
  imports: [RouterLink, LearnTermHint, LearnLabNav, PageShell, LearnLockedCallout],
  templateUrl: './rubrics-and-criteria-lab.html',
  styleUrl: './rubrics-and-criteria-lab.css',
})
export class RubricsAndCriteriaLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('rubrics-and-criteria-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly labPrompt = LAB_PROMPT;
  readonly labAnswer = LAB_ANSWER;
  readonly rubric = RUBRIC;
  readonly scoreOptions = [1, 2, 3, 4, 5];

  readonly openTermId = signal<string | null>(null);
  readonly scores = signal<Record<string, number>>({});
  readonly checked = signal(false);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('rubrics-and-criteria-lab');
  });

  readonly allScored = computed(() => Object.keys(this.scores()).length === this.rubric.length);

  readonly agreementCount = computed(
    () => this.rubric.filter((row) => this.isWithinTolerance(row.id)).length,
  );

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  setScore(rowId: string, score: number): void {
    this.scores.update((current) => ({ ...current, [rowId]: score }));
    this.checked.set(false);
  }

  isWithinTolerance(rowId: string): boolean {
    const row = this.rubric.find((entry) => entry.id === rowId);
    const score = this.scores()[rowId];
    return !!row && score !== undefined && Math.abs(score - row.reference) <= SCORE_TOLERANCE;
  }

  check(): void {
    if (this.allScored()) {
      this.checked.set(true);
    }
  }

  reset(): void {
    this.scores.set({});
    this.checked.set(false);
  }

  markLabComplete(): void {
    this.progress.markComplete('rubrics-and-criteria-lab');
  }
}
