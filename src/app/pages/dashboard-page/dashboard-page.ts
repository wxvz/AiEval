import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ConfirmDeleteModal } from '../../components/confirm-delete-modal/confirm-delete-modal';
import { EmptyState } from '../../components/empty-state/empty-state';
import { EvaluationCard } from '../../components/evaluation-card/evaluation-card';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import { Evaluation } from '../../models';
import { loadWalkthroughContent } from '../../learn/learn-content';
import { LearnHandoffService } from '../../learn/learn-handoff.service';
import { EvaluationService } from '../../services/evaluation.service';
import { EvaluationDayGroup, groupEvaluationsByDay } from '../../utils/group-evaluations-by-day';
import {
  EVALUATIONS_PER_DAY_PAGE,
  clampPageIndex,
  pageCount,
  paginateSlice,
} from '../../utils/paginate';

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, EvaluationCard, EmptyState, LoadingSpinner, ConfirmDeleteModal],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  private readonly evaluationService = inject(EvaluationService);
  private readonly learnHandoff = inject(LearnHandoffService);

  protected readonly loading = this.evaluationService.loading;
  protected readonly loadError = this.evaluationService.loadError;
  protected readonly evaluations = this.evaluationService.evaluations;
  protected readonly dayGroups = computed(() => groupEvaluationsByDay(this.evaluations()));
  protected readonly dayPages = signal<Record<string, number>>({});
  protected readonly deleteTargetId = signal<string | null>(null);
  protected readonly highlightedEvaluationId = computed(() => this.learnHandoff.highlightedEvaluationId());
  protected readonly showLearnBanner = computed(() => {
    this.learnHandoff.highlightedEvaluationId();
    return this.learnHandoff.showDashboardBanner();
  });
  protected readonly learnBannerCopy =
    loadWalkthroughContent().handoffCopy?.dashboardBanner ??
    'Your evaluation from the Learn lab is highlighted below.';

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
      if (this.highlightedEvaluationId() === id) {
        this.learnHandoff.clear();
      }
    }

    this.deleteTargetId.set(null);
  }

  protected dismissLearnBanner(): void {
    this.learnHandoff.dismissBanner();
  }
}
