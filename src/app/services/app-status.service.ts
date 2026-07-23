import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppStatus } from '../models/app-status.model';

/** Fallback when `/api/status` has not loaded or has no active provider (matches preset slot count). */
export const DEFAULT_ANSWER_SLOT_COUNT = 3;

const API = '/api/status';

@Injectable({ providedIn: 'root' })
export class AppStatusService {
  private readonly http = inject(HttpClient);

  private readonly statusSignal = signal<AppStatus | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly status = this.statusSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  /** Live answer-slot count from the active provider; falls back to preset default. */
  readonly answerModelCount = computed(() => {
    const count = this.statusSignal()?.activeProvider?.answerModels.length;
    return count && count > 0 ? count : DEFAULT_ANSWER_SLOT_COUNT;
  });

  async load(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const status = await firstValueFrom(this.http.get<AppStatus>(API));
      this.statusSignal.set(status);
    } catch {
      this.errorSignal.set('Could not load server status.');
    } finally {
      this.loadingSignal.set(false);
    }
  }

  /** Test helper — apply a status payload without HTTP. */
  applyStatusForTests(status: AppStatus | null): void {
    this.statusSignal.set(status);
  }
}
