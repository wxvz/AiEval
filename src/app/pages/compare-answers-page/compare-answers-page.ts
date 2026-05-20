import { Component, computed, effect, HostListener, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import { LeaveDuringAutomationComponent } from '../../components/leave-during-automation/leave-during-automation';
import { EmptyState } from '../../components/empty-state/empty-state';
import { ScoreSummary } from '../../components/score-summary/score-summary';
import { WinnerBadge } from '../../components/winner-badge/winner-badge';
import { Answer, computeScoreSummary, RubricCriterion, Score } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { SettingsService } from '../../services/settings.service';

const AUTO_DISMISS_MS = 3000;

export function upsertCriterionScore(
  scores: Score[],
  criterion: RubricCriterion,
  points: number,
): Score[] {
  const clampedPoints = clampScore(points, criterion.maxPoints);
  const nextScore: Score = {
    criterionId: criterion.id,
    criterionName: criterion.name,
    points: clampedPoints,
    maxPoints: criterion.maxPoints,
  };
  const existingScore = scores.find((score) => score.criterionId === criterion.id);

  if (!existingScore) {
    return [...scores, nextScore];
  }

  return scores.map((score) =>
    score.criterionId === criterion.id
      ? {
          ...score,
          ...nextScore,
          ...(score.notes ? { notes: score.notes } : {}),
        }
      : score,
  );
}

function clampScore(points: number, maxPoints: number): number {
  if (!Number.isFinite(points)) {
    return 0;
  }

  return Math.min(Math.max(points, 0), maxPoints);
}

export function nextAnswerIndex(currentIndex: number, answerCount: number): number {
  return normalizeAnswerIndex(currentIndex + 1, answerCount);
}

export function previousAnswerIndex(currentIndex: number, answerCount: number): number {
  return normalizeAnswerIndex(currentIndex - 1, answerCount);
}

export function normalizeAnswerIndex(index: number, answerCount: number): number {
  if (answerCount <= 0) {
    return 0;
  }

  return ((index % answerCount) + answerCount) % answerCount;
}

export function activeScoresForCriteria(scores: Score[], criteria: RubricCriterion[]): Score[] {
  const activeCriterionIds = new Set(criteria.map((criterion) => criterion.id));

  return scores.filter((score) => activeCriterionIds.has(score.criterionId));
}

@Component({
  selector: 'app-compare-answers-page',
  imports: [
    RouterLink,
    ScoreSummary,
    WinnerBadge,
    EmptyState,
    AutomationControlsComponent,
    LeaveDuringAutomationComponent,
  ],
  templateUrl: './compare-answers-page.html',
  styleUrl: './compare-answers-page.css',
})
export class CompareAnswersPage {
  private readonly route = inject(ActivatedRoute);
  private readonly evaluationService = inject(EvaluationService);
  private readonly settingsService = inject(SettingsService);

  private readonly leaveDuringAutomation = viewChild(LeaveDuringAutomationComponent);
  private readonly answerNotesDrafts = signal<Record<string, string>>({});

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly automating = computed(() =>
    this.evaluationService.isAutomating(this.evaluationId),
  );

  protected readonly selectedAnswerIndex = signal(0);

  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));
  protected readonly activeCriteria = computed(() => {
    const current = this.evaluation();

    return current ? this.evaluationService.getActiveCriteria(current) : [];
  });
  protected readonly showAutomationBanner = computed(() => !!this.evaluation()?.automatedAt);
  protected readonly automationBannerDismissed = signal(false);
  protected readonly selectedAnswer = computed(() => {
    const answers = this.evaluation()?.answers ?? [];

    return answers[normalizeAnswerIndex(this.selectedAnswerIndex(), answers.length)];
  });
  protected readonly selectedAnswerPosition = computed(() => {
    const answerCount = this.evaluation()?.answers.length ?? 0;

    return normalizeAnswerIndex(this.selectedAnswerIndex(), answerCount);
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.settingsService.autoDismissAutomationStatus()) {
        return;
      }

      if (!this.showAutomationBanner() || this.automationBannerDismissed()) {
        return;
      }

      const timeoutId = window.setTimeout(() => {
        this.automationBannerDismissed.set(true);
      }, AUTO_DISMISS_MS);

      onCleanup(() => window.clearTimeout(timeoutId));
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.automating()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this.automating()) {
      return true;
    }

    return this.leaveDuringAutomation()?.prompt() ?? true;
  }

  protected summaryFor(answerId: string) {
    const answer = this.evaluation()?.answers.find((item) => item.id === answerId);

    return answer
      ? computeScoreSummary(activeScoresForCriteria(answer.scores, this.activeCriteria()))
      : { totalPoints: 0, maxPoints: 0, percentage: 0 };
  }

  protected selectAnswer(index: number): void {
    const answerCount = this.evaluation()?.answers.length ?? 0;

    this.selectedAnswerIndex.set(normalizeAnswerIndex(index, answerCount));
  }

  protected previousAnswer(): void {
    const answerCount = this.evaluation()?.answers.length ?? 0;

    this.selectedAnswerIndex.set(previousAnswerIndex(this.selectedAnswerIndex(), answerCount));
  }

  protected nextAnswer(): void {
    const answerCount = this.evaluation()?.answers.length ?? 0;

    this.selectedAnswerIndex.set(nextAnswerIndex(this.selectedAnswerIndex(), answerCount));
  }

  protected scoreFor(answer: Answer, criterionId: string): number | null {
    const score = answer.scores.find((item) => item.criterionId === criterionId);

    return score?.points ?? null;
  }

  protected criterionNotesFor(answer: Answer, criterionId: string): string | null {
    const score = answer.scores.find((item) => item.criterionId === criterionId);
    const notes = score?.notes?.trim();

    return notes ? notes : null;
  }

  protected answerNotesValue(answer: Answer): string {
    const draft = this.answerNotesDrafts()[answer.id];

    if (draft !== undefined) {
      return draft;
    }

    return answer.notes ?? '';
  }

  protected onNotesInput(answer: Answer, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;

    this.answerNotesDrafts.update((drafts) => ({ ...drafts, [answer.id]: value }));
  }

  protected onNotesBlur(answer: Answer, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    const persisted = answer.notes ?? '';

    this.answerNotesDrafts.update((drafts) => {
      const { [answer.id]: _removed, ...rest } = drafts;

      return rest;
    });

    if (value === persisted) {
      return;
    }

    this.evaluationService.updateAnswer(this.evaluationId, answer.id, {
      notes: value,
    });
  }

  protected onScoreInput(answer: Answer, criterion: RubricCriterion, event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!answer) {
      return;
    }

    this.evaluationService.updateAnswer(this.evaluationId, answer.id, {
      scores: upsertCriterionScore(answer.scores, criterion, input.valueAsNumber),
    });
  }

  protected dismissAutomationBanner(): void {
    this.automationBannerDismissed.set(true);
  }

  protected setWinner(answerId: string): void {
    this.evaluationService.setWinner(this.evaluationId, answerId, {
      success: 'Winner marked.',
      error: 'Could not mark winner.',
    });
  }

}
