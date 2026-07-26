import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ConfirmDeleteModal } from '../../components/confirm-delete-modal/confirm-delete-modal';
import { DashboardDayRail } from '../../components/dashboard-day-rail/dashboard-day-rail';
import { EmptyState } from '../../components/empty-state/empty-state';
import { EvaluationCard } from '../../components/evaluation-card/evaluation-card';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import { PageShell } from '../../components/page-shell/page-shell';
import { Evaluation } from '../../models';
import { loadWalkthroughContent } from '../../learn/walkthrough-content';
import { LEARN_LESSON_QUERY, LearnHandoffService } from '../../learn/learn-handoff.service';
import { getLesson } from '../../learn/curriculum';
import { EvaluationService } from '../../services/evaluation.service';
import { EvaluationDayGroup, localDayKey } from '../../utils/group-evaluations-by-day';
import { groupEvaluationsByMonth } from '../../utils/group-evaluations-by-month';
import {
  EVALUATIONS_PER_DAY_PAGE,
  clampPageIndex,
  pageCount,
  paginateSlice,
} from '../../utils/paginate';

@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    DashboardDayRail,
    EvaluationCard,
    EmptyState,
    LoadingSpinner,
    ConfirmDeleteModal,
    PageShell,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  private readonly evaluationService = inject(EvaluationService);
  private readonly learnHandoff = inject(LearnHandoffService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly loading = this.evaluationService.loading;
  protected readonly loadError = this.evaluationService.loadError;
  protected readonly evaluations = this.evaluationService.evaluations;
  protected readonly monthGroups = computed(() => groupEvaluationsByMonth(this.evaluations()));
  protected readonly selectedDayKey = signal<string | null>(null);
  protected readonly selectedDayGroup = computed<EvaluationDayGroup | null>(() => {
    const selectedDayKey = this.selectedDayKey();

    for (const month of this.monthGroups()) {
      const selectedDay = month.days.find((day) => day.dayKey === selectedDayKey);
      if (selectedDay) {
        return selectedDay;
      }
    }

    return null;
  });
  protected readonly dayPages = signal<Record<string, number>>({});
  protected readonly deleteTargetId = signal<string | null>(null);

  /** Query `learnLesson` when present; drives Learn chrome without falling back to another lab. */
  private readonly requestedLearnLessonId = computed(
    () => this.queryParamMap().get(LEARN_LESSON_QUERY),
  );

  protected readonly highlightedEvaluationId = computed(() => {
    this.learnHandoff.highlightedEvaluationId();
    const requested = this.requestedLearnLessonId();
    if (requested) {
      // No handoff for the requested lab → do not highlight another lab's evaluation.
      return this.learnHandoff.evaluationIdForLesson(requested);
    }
    return this.learnHandoff.highlightedEvaluationId();
  });

  protected readonly showLearnBanner = computed(() => {
    this.learnHandoff.highlightedEvaluationId();
    const requested = this.requestedLearnLessonId();
    if (requested && !this.learnHandoff.hasHandoffForLesson(requested)) {
      return false;
    }
    return this.learnHandoff.showDashboardBanner();
  });

  protected readonly learnBannerCopy = computed(() => {
    const lessonId = this.requestedLearnLessonId() ?? this.learnHandoff.lessonId();
    if (!lessonId) {
      return 'Your evaluation from the Learn lab is highlighted below.';
    }
    return (
      loadWalkthroughContent(lessonId).handoffCopy?.dashboardBanner ??
      'Your evaluation from the Learn lab is highlighted below.'
    );
  });

  protected readonly learnLabRoute = computed(() => {
    const lessonId = this.requestedLearnLessonId() ?? this.learnHandoff.lessonId();
    if (!lessonId) {
      return '/learn';
    }
    return getLesson(lessonId)?.route ?? '/learn';
  });

  constructor() {
    effect(() => {
      const lessonId = this.queryParamMap().get(LEARN_LESSON_QUERY);
      if (lessonId) {
        this.learnHandoff.activateLesson(lessonId);
      }
    });

    effect(() => {
      const openCompare = this.queryParamMap().get('openCompare') === '1';
      if (!openCompare) {
        return;
      }
      // Resolve Compare from the requested lab — do not fall through to another lab's active handoff.
      const lessonId = this.queryParamMap().get(LEARN_LESSON_QUERY);
      const evalId = lessonId
        ? this.learnHandoff.evaluationIdForLesson(lessonId)
        : this.learnHandoff.highlightedEvaluationId();
      if (!evalId) {
        return;
      }
      void this.router.navigate(['/evaluations', evalId, 'compare'], { replaceUrl: true });
    });

    effect(() => {
      const evaluations = this.evaluations();
      const months = this.monthGroups();
      const selectedDayKey = this.selectedDayKey();
      const selectedDayExists = months.some((month) =>
        month.days.some((day) => day.dayKey === selectedDayKey),
      );

      if (selectedDayExists) {
        return;
      }

      const highlightedId = this.highlightedEvaluationId();
      const highlightedEvaluation = evaluations.find(
        (evaluation) => evaluation.id === highlightedId,
      );
      const nextDayKey = highlightedEvaluation
        ? localDayKey(highlightedEvaluation.updatedAt)
        : (months[0]?.days[0]?.dayKey ?? null);

      this.selectedDayKey.set(nextDayKey);
    });
  }

  protected selectDay(dayKey: string): void {
    this.selectedDayKey.set(dayKey);
  }

  protected evaluationsForPage(group: EvaluationDayGroup): Evaluation[] {
    const pageIndex = this.dayPageIndex(group);
    return paginateSlice(group.evaluations, pageIndex);
  }

  protected dayPageIndex(group: EvaluationDayGroup): number {
    return clampPageIndex(this.dayPages()[group.dayKey] ?? 0, group.evaluations.length);
  }

  protected dayPageCount(group: EvaluationDayGroup): number {
    return pageCount(group.evaluations.length);
  }

  protected showDayPagination(group: EvaluationDayGroup): boolean {
    return group.evaluations.length > EVALUATIONS_PER_DAY_PAGE;
  }

  protected setDayPage(dayKey: string, pageIndex: number, itemCount: number): void {
    const nextPage = clampPageIndex(pageIndex, itemCount);
    this.dayPages.update((pages) => ({ ...pages, [dayKey]: nextPage }));
  }

  protected dayPageNumbers(group: EvaluationDayGroup): number[] {
    return Array.from({ length: this.dayPageCount(group) }, (_, index) => index);
  }

  protected requestDelete(id: string): void {
    this.deleteTargetId.set(id);
    const modalElement = document.getElementById('deleteEvaluationModal');

    if (modalElement) {
      bootstrap.Modal.getOrCreateInstance(modalElement).show();
    }
  }

  protected confirmDelete(): void {
    const id = this.deleteTargetId();

      if (id) {
      this.evaluationService.delete(id, {
        success: 'Evaluation deleted.',
        error: 'Could not delete evaluation.',
      });
      const lessonForEval = this.learnHandoff.lessonIdForEvaluation(id);
      if (lessonForEval) {
        this.learnHandoff.clearLesson(lessonForEval);
      }
    }

    this.deleteTargetId.set(null);
  }

  protected dismissLearnBanner(): void {
    this.learnHandoff.dismissBanner();
  }
}
