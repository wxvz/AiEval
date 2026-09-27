import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnLockedCallout } from '../../components/learn-locked-callout/learn-locked-callout';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';

export type AnswerPick = 'a' | 'b';

interface ComparisonCriterion {
  id: string;
  label: string;
  reference: AnswerPick;
  rationale: string;
}

const LAB_PROMPT = 'Explain to a customer why their export failed and what to do next.';

const ANSWER_A =
  'Your export failed because the file exceeded the 50 MB limit. Split the export into smaller date ranges ' +
  '(for example, one month at a time) and retry. If it still fails, contact support with the export ID shown ' +
  'in the error banner.';

const ANSWER_B =
  'Sorry about that! Exports can fail for lots of reasons: server hiccups, big files, network issues. ' +
  'Usually trying again later works. Our system is normally very reliable, so this is probably temporary.';

const CRITERIA: ComparisonCriterion[] = [
  {
    id: 'accuracy',
    label: 'Accuracy: does it state the actual cause?',
    reference: 'a',
    rationale: 'Answer A names the real cause (50 MB limit). Answer B guesses at several causes without commitment.',
  },
  {
    id: 'actionability',
    label: 'Actionability: can the customer act on it?',
    reference: 'a',
    rationale: 'Answer A gives concrete steps (split by date range, retry, contact support with the export ID). Answer B only says "try again later".',
  },
  {
    id: 'tone',
    label: 'Tone: is it professional and reassuring?',
    reference: 'a',
    rationale: 'Both are polite, but B leans on vague reassurance ("normally very reliable") that can erode trust when the export just failed. A stays factual and calm.',
  },
];

@Component({
  selector: 'app-comparing-answers-lab',
  imports: [RouterLink, LearnTermHint, LearnLabNav, PageShell, LearnLockedCallout],
  templateUrl: './comparing-answers-lab.html',
  styleUrl: './comparing-answers-lab.css',
})
export class ComparingAnswersLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('comparing-answers-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly labPrompt = LAB_PROMPT;
  readonly answerA = ANSWER_A;
  readonly answerB = ANSWER_B;
  readonly criteria = CRITERIA;

  readonly openTermId = signal<string | null>(null);
  readonly picks = signal<Record<string, AnswerPick>>({});
  readonly checked = signal(false);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('comparing-answers-lab');
  });

  readonly allPicked = computed(
    () => Object.keys(this.picks()).length === this.criteria.length,
  );

  readonly agreementCount = computed(
    () =>
      this.criteria.filter((criterion) => this.picks()[criterion.id] === criterion.reference)
        .length,
  );

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  pick(criterionId: string, choice: AnswerPick): void {
    this.picks.update((current) => ({ ...current, [criterionId]: choice }));
    this.checked.set(false);
  }

  agreesWithReference(criterionId: string): boolean {
    const criterion = this.criteria.find((entry) => entry.id === criterionId);
    return !!criterion && this.picks()[criterionId] === criterion.reference;
  }

  check(): void {
    if (this.allPicked()) {
      this.checked.set(true);
    }
  }

  reset(): void {
    this.picks.set({});
    this.checked.set(false);
  }

  markLabComplete(): void {
    this.progress.markComplete('comparing-answers-lab');
  }
}
