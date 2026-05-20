import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { LlmPreset, ServerSettings } from '../models/llm-preset.model';
import { FeedbackService } from './feedback.service';
import { messageFromHttpError } from './http-error-message';

const API = '/api/settings';

@Injectable({ providedIn: 'root' })
export class ServerSettingsService {
  private readonly http = inject(HttpClient);
  private readonly feedback = inject(FeedbackService);

  private readonly llmPresetSignal = signal<LlmPreset | null>(null);
  private readonly envDefaultLlmPresetSignal = signal<LlmPreset | null>(null);
  private readonly loadingSignal = signal(false);
  private readonly patchingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly llmPreset = this.llmPresetSignal.asReadonly();
  readonly envDefaultLlmPreset = this.envDefaultLlmPresetSignal.asReadonly();
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

  async load(): Promise<void> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    try {
      const settings = await firstValueFrom(this.http.get<ServerSettings>(API));
      this.applySettings(settings);
    } catch (error) {
      this.errorSignal.set(
        messageFromHttpError(error, 'Could not load server settings.'),
      );
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async setLlmPreset(preset: LlmPreset, options?: { suppressFeedback?: boolean }): Promise<boolean> {
    const previous = this.llmPreset();

    if (previous === preset) {
      return true;
    }

    if (previous === null) {
      return false;
    }

    this.llmPresetSignal.set(preset);
    this.patchingSignal.set(true);

    try {
      const settings = await firstValueFrom(
        this.http.patch<ServerSettings>(API, { llmPreset: preset }),
      );
      this.applySettings(settings);
      return true;
    } catch (error) {
      this.llmPresetSignal.set(previous);

      if (!options?.suppressFeedback) {
        this.feedback.error(messageFromHttpError(error, 'Could not update performance preset.'));
      }

      return false;
    } finally {
      this.patchingSignal.set(false);
    }
  }

  async resetToEnvDefault(): Promise<boolean> {
    const envDefault = this.envDefaultLlmPreset();

    if (envDefault === null) {
      return false;
    }

    return this.setLlmPreset(envDefault, { suppressFeedback: true });
  }

  private applySettings(settings: ServerSettings): void {
    this.llmPresetSignal.set(settings.llmPreset);
    this.envDefaultLlmPresetSignal.set(settings.envDefaultLlmPreset);
    this.errorSignal.set(null);
  }
}
