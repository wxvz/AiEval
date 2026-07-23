import { DatePipe } from '@angular/common';
import { Component, computed, effect, HostListener, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import { LeaveDuringAutomationComponent } from '../../components/leave-during-automation/leave-during-automation';
import { EmptyState } from '../../components/empty-state/empty-state';
import { ScoreSummary } from '../../components/score-summary/score-summary';
import { TokenUsageBadge } from '../../components/token-usage-badge/token-usage-badge';
import { WinnerBadge } from '../../components/winner-badge/winner-badge';
import { Answer, computeScoreSummary, EvaluationRunEstimate, RubricCriterion, Score, TaskDifficulty } from '../../models';
import { LearnHandoffService } from '../../learn/learn-handoff.service';
import { EvaluationService } from '../../services/evaluation.service';
import { SettingsService } from '../../services/settings.service';
import { useAutomationPageContext } from '../../utils/automation-page-context';
import { formatRunEstimateLabel, scoresMayBeStale } from '../../utils/scoring-config-revision';

const AUTO_DISMISS_MS = 3000;

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

/** Blind labels until a winner exists; then reveal model names. */
export function displayAnswerLabel(
  answer: Answer,
  index: number,
  options: { blindJudging: boolean; hasWinner: boolean },
): string {
  if (!options.blindJudging || options.hasWinner) {
    return answer.label;
  }

  return `Answer ${String.fromCharCode(65 + index)}`;
}

@Component({
  selector: 'app-compare-answers-page',
  imports: [
    RouterLink,
    FormsModule,
    DatePipe,
    ScoreSummary,
    WinnerBadge,
    TokenUsageBadge,
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
  private readonly learnHandoff = inject(LearnHandoffService);

  private readonly leaveDuringAutomation = viewChild(LeaveDuringAutomationComponent);
  private readonly answerNotesDrafts = signal<Record<string, string>>({});
  protected readonly overrideReasonDraft = signal('');
  protected readonly pendingOverride = signal<
    | { kind: 'winner'; answerId: string }
    | { kind: 'score'; answer: Answer; criterion: RubricCriterion; points: number }
    | null
  >(null);
  protected readonly runEstimate = signal<EvaluationRunEstimate | null>(null);
  protected readonly reScoreStrictness = signal<TaskDifficulty>('balanced');

  protected readonly evaluationId = this.route.snapshot.paramMap.get('id') ?? '';
  private readonly automationPage = useAutomationPageContext(() => this.evaluationId);

  protected readonly automating = this.automationPage.automating;

  protected readonly selectedAnswerIndex = signal(0);

  protected readonly evaluation = computed(() => this.evaluationService.getById(this.evaluationId));
  protected readonly showLearnBackLink = computed(() => {
    this.learnHandoff.highlightedEvaluationId();
    return this.learnHandoff.highlightedEvaluationId() === this.evaluationId;
  });
  protected readonly displayTokenUsage = this.automationPage.displayTokenUsage;
  protected readonly activeCriteria = computed(() => {
    const current = this.evaluation();

    return current ? this.evaluationService.getActiveCriteria(current) : [];
  });
  protected readonly showAutomationBanner = computed(() => !!this.evaluation()?.automatedAt);
  protected readonly scoresStale = computed(() => {
    const current = this.evaluation();
    return current ? scoresMayBeStale(current, this.activeCriteria()) : false;
  });
  protected readonly blindJudging = computed(
    () => this.evaluation()?.evaluationConfig.blindJudging ?? true,
  );
  protected readonly hasWinner = computed(() => {
    const current = this.evaluation();

    if (!current) {
      return false;
    }

    return !!current.winnerAnswerId || current.answers.some((answer) => !!answer.isWinner);
  });
  protected readonly estimateLabel = computed(() => {
    const estimate = this.runEstimate();
    return estimate ? formatRunEstimateLabel(estimate) : null;
  });
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
    effect(() => {
      const current = this.evaluation();

      if (!current) {
        return;
      }

      this.reScoreStrictness.set(current.evaluationConfig.judgeProfile.strictness);
      void this.evaluationService.estimateRun(current, 'score').then((estimate) => {
        this.runEstimate.set(estimate);
      });
    });

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
      ? computeScoreSummary(
          activeScoresForCriteria(answer.scores, this.activeCriteria()),
          this.activeCriteria(),
        )
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

  protected criterionConfidenceFor(answer: Answer, criterionId: string): number | null {
    const confidence = answer.scores.find((item) => item.criterionId === criterionId)?.confidence;
    return confidence === undefined ? null : Math.round(confidence * 100);
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

  protected displayLabel(answer: Answer, index: number): string {
    return displayAnswerLabel(answer, index, {
      blindJudging: this.blindJudging(),
      hasWinner: this.hasWinner(),
    });
  }

  protected isLowConfidence(answer: Answer, criterionId: string): boolean {
    const confidence = answer.scores.find((score) => score.criterionId === criterionId)?.confidence;
    return confidence !== undefined && confidence < 0.6;
  }

  protected onScoreInput(answer: Answer, criterion: RubricCriterion, event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!answer || this.automating()) {
      return;
    }

    this.pendingOverride.set({
      kind: 'score',
      answer,
      criterion,
      points: input.valueAsNumber,
    });
    this.overrideReasonDraft.set('');
  }

  protected onWinnerClick(answerId: string): void {
    if (this.automating()) {
      return;
    }

    this.pendingOverride.set({ kind: 'winner', answerId });
    this.overrideReasonDraft.set('');
  }

  protected cancelOverride(): void {
    this.pendingOverride.set(null);
    this.overrideReasonDraft.set('');
  }

  protected confirmOverride(): void {
    const pending = this.pendingOverride();
    const reason = this.overrideReasonDraft().trim();

    if (!pending || reason.length < 3) {
      return;
    }

    if (pending.kind === 'winner') {
      this.evaluationService.setWinner(this.evaluationId, pending.answerId, reason, {
        success: 'Winner marked.',
        error: 'Could not mark winner.',
      });
    } else {
      this.evaluationService.updateScoreWithOverride(
        this.evaluationId,
        pending.answer.id,
        pending.criterion,
        pending.points,
        reason,
      );
    }

    this.cancelOverride();
  }

  protected applyReScoreStrictness(): void {
    this.evaluationService.updateJudgeStrictness(this.evaluationId, this.reScoreStrictness(), {
      success: 'Judge strictness updated for the next scoring run.',
      error: 'Could not update judge strictness.',
    });
  }

  protected dismissAutomationBanner(): void {
    this.automationBannerDismissed.set(true);
  }

  protected setWinner(answerId: string): void {
    this.onWinnerClick(answerId);
  }

}
