import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';

interface MatchExample {
  id: string;
  inputLabel: string;
  targetLabel: string;
}

const EXAMPLES: MatchExample[] = [
  { id: 'ticket', inputLabel: '"Reset my password" (support message)', targetLabel: 'Intent: account_recovery' },
  { id: 'photo', inputLabel: 'Photo of a golden retriever', targetLabel: 'Label: dog' },
  { id: 'review', inputLabel: '"Great product, works perfectly!" (review)', targetLabel: 'Sentiment: positive' },
  { id: 'xor', inputLabel: 'XOR inputs (0, 1)', targetLabel: 'Output: 1' },
];

/** Targets shown in a fixed scrambled order so pairs are not aligned by row. */
const TARGET_ORDER = ['xor', 'review', 'ticket', 'photo'];

@Component({
  selector: 'app-learning-from-examples-lab',
  imports: [RouterLink, LearnTermHint, LearnLabNav, PageShell],
  templateUrl: './learning-from-examples-lab.html',
  styleUrl: './learning-from-examples-lab.css',
})
export class LearningFromExamplesLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('learning-from-examples-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly examples = EXAMPLES;
  readonly targets = TARGET_ORDER.map(
    (id) => EXAMPLES.find((example) => example.id === id)!,
  );

  readonly openTermId = signal<string | null>(null);
  readonly selectedInputId = signal<string | null>(null);
  /** input example id → matched target example id */
  readonly matches = signal<Record<string, string>>({});
  readonly checked = signal(false);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('learning-from-examples-lab');
  });

  readonly allMatched = computed(
    () => Object.keys(this.matches()).length === this.examples.length,
  );

  readonly correctCount = computed(
    () =>
      Object.entries(this.matches()).filter(([inputId, targetId]) => inputId === targetId).length,
  );

  readonly solved = computed(
    () => this.checked() && this.correctCount() === this.examples.length,
  );

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  selectInput(id: string): void {
    this.selectedInputId.set(this.selectedInputId() === id ? null : id);
  }

  matchedTargetFor(inputId: string): string | null {
    const targetId = this.matches()[inputId];
    if (!targetId) {
      return null;
    }
    return this.examples.find((example) => example.id === targetId)?.targetLabel ?? null;
  }

  isTargetUsed(targetId: string): boolean {
    return Object.values(this.matches()).includes(targetId);
  }

  assignTarget(targetId: string): void {
    const inputId = this.selectedInputId();
    if (!inputId || this.isTargetUsed(targetId)) {
      return;
    }
    this.matches.update((current) => ({ ...current, [inputId]: targetId }));
    this.selectedInputId.set(null);
    this.checked.set(false);
  }

  clearMatch(inputId: string): void {
    this.matches.update((current) => {
      const next = { ...current };
      delete next[inputId];
      return next;
    });
    this.checked.set(false);
  }

  isMatchCorrect(inputId: string): boolean {
    return this.matches()[inputId] === inputId;
  }

  check(): void {
    if (this.allMatched()) {
      this.checked.set(true);
    }
  }

  reset(): void {
    this.matches.set({});
    this.selectedInputId.set(null);
    this.checked.set(false);
  }

  markLabComplete(): void {
    if (!this.solved()) {
      return;
    }
    this.progress.markComplete('learning-from-examples-lab');
  }
}
