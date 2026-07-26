import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { LlmPreset, ServerSettings } from '../models/llm-preset.model';
import { readStoredApiToken, writeStoredApiToken } from './api-token.storage';
import { FeedbackService } from './feedback.service';
import { messageFromHttpError } from './http-error-message';

const API = '/api/settings';

export interface ServerSettingsLoadOptions {
  /** Refresh without toggling the loading flag (background / panel open). */
  soft?: boolean;
  /** No-op when a preset is already cached (skip redundant open refresh after prefetch). */
  skipIfCached?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ServerSettingsService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(FeedbackService);

  private readonly llmPresetSignal = signal<LlmPreset | null>(null);
  private readonly envDefaultLlmPresetSignal = signal<LlmPreset | null>(null);
  private readonly apiTokenRequiredSignal = signal(false);
  private readonly loadingSignal = signal(false);
  private readonly patchingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  /**
   * Bumped on preset mutations so in-flight GET /api/settings responses cannot
   * overwrite a newer local/server mutation.
   */
  private settingsEpoch = 0;
  /** Bumped on each load() start; only the latest load may apply its response. */
  private loadSeq = 0;
  /** Nested hard loads — loading flag clears when the last one finishes. */
  private hardLoadsInFlight = 0;
  /** Nested patches — patching flag clears when the last one finishes. */
  private patchesInFlight = 0;
  /** Shared soft GET so prefetch + open do not double-fetch while one is pending. */
  private softLoadInFlight: Promise<void> | null = null;

  readonly llmPreset = this.llmPresetSignal.asReadonly();
  readonly envDefaultLlmPreset = this.envDefaultLlmPresetSignal.asReadonly();
  readonly apiTokenRequired = this.apiTokenRequiredSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly patching = this.patchingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  readonly presetDisabled = computed(
    () =>
      this.loading() ||
      this.patching() ||
      this.error() !== null ||
      this.llmPreset() === null,
  );

  getApiToken(): string | null {
    return readStoredApiToken();
  }

  setApiToken(token: string): void {
    writeStoredApiToken(token);
  }

  async load(options?: ServerSettingsLoadOptions): Promise<void> {
    const soft = options?.soft === true;

    if (soft && options?.skipIfCached === true && this.llmPresetSignal() !== null) {
      return;
    }

    if (soft && this.softLoadInFlight) {
      return this.softLoadInFlight;
    }

    const run = this.executeLoad(soft);
    if (soft) {
      const tracked = run.finally(() => {
        if (this.softLoadInFlight === tracked) {
          this.softLoadInFlight = null;
        }
      });
      this.softLoadInFlight = tracked;
      return tracked;
    }

    return run;
  }

  async setLlmPreset(preset: LlmPreset, options?: { suppressFeedback?: boolean }): Promise<boolean> {
    const previous = this.llmPreset();

    if (previous === preset) {
      return true;
    }

    if (previous === null) {
      return false;
    }

    // Invalidate in-flight GETs so their responses cannot restore `previous`.
    this.settingsEpoch += 1;
    const epoch = this.settingsEpoch;
    this.llmPresetSignal.set(preset);
    this.patchesInFlight += 1;
    this.patchingSignal.set(true);

    try {
      const settings = await firstValueFrom(
        this.http.patch<ServerSettings>(API, { llmPreset: preset }),
      );
      if (epoch !== this.settingsEpoch) {
        // Newer mutation owns the UI; only report success if that preset is still ours.
        return this.llmPreset() === preset;
      }
      this.applySettings(settings);
      return true;
    } catch (error) {
      if (epoch === this.settingsEpoch) {
        this.llmPresetSignal.set(previous);

        if (!options?.suppressFeedback) {
          this.feedback.error(messageFromHttpError(error, 'Could not update performance preset.'));
        }
      }

      return false;
    } finally {
      this.patchesInFlight = Math.max(0, this.patchesInFlight - 1);
      if (this.patchesInFlight === 0) {
        this.patchingSignal.set(false);
      }
    }
  }

  async resetToEnvDefault(): Promise<boolean> {
    const envDefault = this.envDefaultLlmPreset();

    if (envDefault === null) {
      return false;
    }

    return this.setLlmPreset(envDefault, { suppressFeedback: true });
  }

  private async executeLoad(soft: boolean): Promise<void> {
    const seq = ++this.loadSeq;
    const epochAtStart = this.settingsEpoch;

    if (!soft) {
      this.hardLoadsInFlight += 1;
      this.loadingSignal.set(true);
    }
    this.errorSignal.set(null);

    try {
      const settings = await firstValueFrom(this.http.get<ServerSettings>(API));
      if (seq !== this.loadSeq || epochAtStart !== this.settingsEpoch) {
        return;
      }
      this.applySettings(settings);
    } catch (error) {
      if (seq !== this.loadSeq || epochAtStart !== this.settingsEpoch) {
        return;
      }
      this.errorSignal.set(
        messageFromHttpError(error, 'Could not load server settings.'),
      );
    } finally {
      if (!soft) {
        this.hardLoadsInFlight = Math.max(0, this.hardLoadsInFlight - 1);
        if (this.hardLoadsInFlight === 0) {
          this.loadingSignal.set(false);
        }
      }
    }
  }

  private applySettings(settings: ServerSettings): void {
    this.llmPresetSignal.set(settings.llmPreset);
    this.envDefaultLlmPresetSignal.set(settings.envDefaultLlmPreset);
    this.apiTokenRequiredSignal.set(!!settings.apiTokenRequired);
    this.errorSignal.set(null);
  }
}
