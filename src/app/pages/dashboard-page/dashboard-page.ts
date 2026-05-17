import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ConfirmDeleteModal } from '../../components/confirm-delete-modal/confirm-delete-modal';
import { EmptyState } from '../../components/empty-state/empty-state';
import { EvaluationCard } from '../../components/evaluation-card/evaluation-card';
import { LoadingSpinner } from '../../components/loading-spinner/loading-spinner';
import { EvaluationService } from '../../services/evaluation.service';

declare const bootstrap: {
  Modal: {
    getOrCreateInstance: (element: Element) => { show: () => void; hide: () => void };
  };
};

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, EvaluationCard, EmptyState, LoadingSpinner, ConfirmDeleteModal],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  private readonly evaluationService = inject(EvaluationService);

  protected readonly loading = signal(false);
  protected readonly evaluations = this.evaluationService.evaluations;
  protected readonly deleteTargetId = signal<string | null>(null);

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
      this.evaluationService.delete(id);
    }

    this.deleteTargetId.set(null);
  }
}
