import { HttpClient } from '@angular/common/http';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import {
  AppStatus,
  CriteriaMode,
  LlmPreset,
  MongoStatus,
  ProviderProbeStatus,
} from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import { FeedbackService } from '../../services/feedback.service';
import {
  AutomationProviderPreference,
  SettingsService,
} from '../../services/settings.service';
import { ServerSettingsService } from '../../services/server-settings.service';
import { Theme, ThemeService } from '../../services/theme.service';
import {
  automationPreferenceHint,
  formatAutoDismiss,
  formatAutomationPreference,
  formatCriteriaMode,
  formatLearnUnlockAll,
  formatLlmPreset,
  formatTheme,
  sanitizeProviderReason,
  serverAggregateMessage,
  serverAggregateReady,
} from '../../utils/settings-status';
import { computeModelLeaderboard } from '../../utils/model-leaderboard';
import { formatProviderLabel } from '../provider-choice-modal/provider-choice-modal';
import { ModelLeaderboard } from '../model-leaderboard/model-leaderboard';

const OFFCANVAS_ID = 'appSettingsOffcanvas';
@Component({
  selector: 'app-settings-aside',
  imports: [RouterLink, ModelLeaderboard],
  templateUrl: './settings-aside.html',
  styleUrl: './settings-aside.css',
})
export class SettingsAside {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly settingsService = inject(SettingsService);
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly themeService = inject(ThemeService);
  private readonly evaluationService = inject(EvaluationService);
  private readonly feedback = inject(FeedbackService);

  private readonly offcanvasElement = viewChild<ElementRef<HTMLElement>>('offcanvas');
  private evaluationsLoadRequested = false;

  protected readonly offcanvasId = OFFCANVAS_ID;
  protected readonly theme = this.themeService.theme;
  protected readonly defaultCriteriaMode = this.settingsService.defaultCriteriaMode;
  protected readonly automationProviderPreference =
    this.settingsService.automationProviderPreference;
  protected readonly autoDismissAutomationStatus =
    this.settingsService.autoDismissAutomationStatus;
  protected readonly learnUnlockAll = this.settingsService.learnUnlockAll;

  protected readonly serverLlmPreset = this.serverSettingsService.llmPreset;
  protected readonly envDefaultLlmPreset = this.serverSettingsService.envDefaultLlmPreset;
  protected readonly apiTokenRequired = this.serverSettingsService.apiTokenRequired;
  protected readonly serverSettingsLoading = this.serverSettingsService.loading;
  protected readonly serverSettingsPatching = this.serverSettingsService.patching;
  protected readonly serverSettingsError = this.serverSettingsService.error;
  protected readonly automating = computed(() => this.evaluationService.isAutomating());
  protected readonly presetDisabled = computed(
    () => this.serverSettingsService.presetDisabled() || this.automating(),
  );

  protected readonly apiTokenDraft = signal('');
  protected readonly hasStoredApiToken = signal(false);
  protected readonly statusRefreshing = signal(false);
  protected readonly statusError = signal<string | null>(null);
  protected readonly status = signal<AppStatus | null>(null);
  /** Guards overlapping /api/status calls without driving the Refresh button UI. */
  private statusRequestInFlight = false;
  /** User clicked Refresh while a silent status request was still in flight. */
  private pendingUserStatusRefresh = false;
  /** Dedupe shown-event + already-visible fallback loads for the current open. */
  private panelDataLoadedForOpen = false;

  protected readonly evaluationCount = this.evaluationService.count;
  protected readonly evaluationsLoading = this.evaluationService.loading;
  protected readonly evaluationsLoadError = this.evaluationService.loadError;

  protected readonly leaderboardEntries = computed(() =>
    computeModelLeaderboard(this.evaluationService.evaluations()),
  );

  protected readonly preferencesSummary = computed(() => {
    const preset = this.serverLlmPreset();

    return [
      { label: 'Theme', value: formatTheme(this.theme()) },
      { label: 'Default rubric', value: formatCriteriaMode(this.defaultCriteriaMode()) },
      {
        label: 'Automation',
        value: formatAutomationPreference(this.automationProviderPreference()),
      },
      { label: 'Auto-dismiss', value: formatAutoDismiss(this.autoDismissAutomationStatus()) },
      { label: 'Learn access', value: formatLearnUnlockAll(this.learnUnlockAll()) },
      {
        label: 'Server preset',
        value: preset ? formatLlmPreset(preset) : '—',
      },
    ];
  });

  protected readonly envDefaultPresetLabel = computed(() => {
    const envDefault = this.envDefaultLlmPreset();
    return envDefault ? formatLlmPreset(envDefault) : 'Balanced';
  });

  protected readonly aggregateReady = computed(() => {
    const serverStatus = this.status();

    if (!serverStatus) {
      return false;
    }

    return serverAggregateReady(serverStatus.mongo.ok, serverStatus.activeProvider !== null);
  });

  protected readonly aggregateMessage = computed(() => {
    const serverStatus = this.status();

    if (!serverStatus) {
      return 'Loading server status…';
    }

    const mongoReason =
      !serverStatus.mongo.ok && 'reason' in serverStatus.mongo
        ? sanitizeProviderReason(serverStatus.mongo.reason)
        : undefined;

    return serverAggregateMessage(
      serverStatus.mongo.ok,
      serverStatus.activeProvider !== null,
      mongoReason,
    );
  });

  protected readonly preferenceHint = computed(() => {
    const serverStatus = this.status();

    if (!serverStatus?.activeProvider) {
      return null;
    }

    return automationPreferenceHint(
      this.automationProviderPreference(),
      serverStatus.activeProvider.name,
    );
  });

  protected readonly formatProvider = formatProviderLabel;

  constructor() {
    effect(() => {
      if (!this.settingsService.isOpen()) {
        return;
      }

      untracked(() => {
        this.panelDataLoadedForOpen = false;

        // Local token is available immediately — don't wait on the network.
        const stored = this.serverSettingsService.getApiToken() ?? '';
        this.apiTokenDraft.set(stored);
        this.hasStoredApiToken.set(!!stored);

        // If the panel is already visible, `show()` is skipped and `shown` may not re-fire.
        const element = this.offcanvasElement()?.nativeElement;
        if (
          element &&
          (element.classList.contains('show') || element.classList.contains('showing'))
        ) {
          this.ensurePanelDataForCurrentOpen();
        }
      });
    });

    afterRenderEffect(() => {
      const element = this.offcanvasElement()?.nativeElement;

      if (!element) {
        return;
      }

      const open = this.settingsService.isOpen();
      const instance = bootstrap.Offcanvas.getOrCreateInstance(element);
      const visible =
        element.classList.contains('show') || element.classList.contains('showing');

      if (open) {
        if (!visible) {
          instance.show();
        } else {
          this.ensurePanelDataForCurrentOpen();
        }
        return;
      }

      if (visible) {
        instance.hide();
      }
    });

    afterNextRender(() => {
      // Prefetch so the first open already has a cached preset (no Models disable flash).
      void this.serverSettingsService.load({ soft: true });

      const element = this.offcanvasElement()?.nativeElement;

      if (!element) {
        return;
      }

      const onHidden = () => {
        if (this.settingsService.isOpen()) {
          this.settingsService.close();
        }
      };

      // Prefer loading after the slide finishes so status/settings updates don't jank it.
      const onShown = () => {
        this.ensurePanelDataForCurrentOpen();
      };

      element.addEventListener('hidden.bs.offcanvas', onHidden);
      element.addEventListener('shown.bs.offcanvas', onShown);
      this.destroyRef.onDestroy(() => {
        element.removeEventListener('hidden.bs.offcanvas', onHidden);
        element.removeEventListener('shown.bs.offcanvas', onShown);
      });
    });
  }

  protected dismiss(): void {
    this.settingsService.close();
  }

  protected setTheme(theme: Theme): void {
    if (this.theme() === theme) {
      return;
    }

    this.themeService.setTheme(theme);
    this.feedback.success(`Theme set to ${formatTheme(theme)}.`);
  }

  protected setDefaultCriteriaMode(mode: CriteriaMode): void {
    if (this.defaultCriteriaMode() === mode) {
      return;
    }

    this.settingsService.setDefaultCriteriaMode(mode);
    this.feedback.success(`Default rubric set to ${formatCriteriaMode(mode)}.`);
  }

  protected setAutomationProviderPreference(preference: AutomationProviderPreference): void {
    if (this.automationProviderPreference() === preference) {
      return;
    }

    this.settingsService.setAutomationProviderPreference(preference);
    this.feedback.success(
      `Automation preference set to ${formatAutomationPreference(preference)}.`,
    );
  }

  protected setAutoDismissAutomationStatus(enabled: boolean): void {
    if (this.autoDismissAutomationStatus() === enabled) {
      return;
    }

    this.settingsService.setAutoDismissAutomationStatus(enabled);
    this.feedback.success(`Auto-dismiss successful automation messages ${formatAutoDismiss(enabled)}.`);
  }

  protected setLearnUnlockAll(enabled: boolean): void {
    if (this.learnUnlockAll() === enabled) {
      return;
    }

    this.settingsService.setLearnUnlockAll(enabled);
    this.feedback.success(
      enabled ? 'All Learn lessons are now open.' : 'Learn lessons follow prerequisites again.',
    );
  }

  protected async setLlmPreset(preset: LlmPreset): Promise<void> {
    const changed = await this.serverSettingsService.setLlmPreset(preset);

    if (changed) {
      this.feedback.success(`Performance preset set to ${formatLlmPreset(preset)}.`);
      this.refreshStatus();
    }
  }

  protected onApiTokenDraftInput(value: string): void {
    this.apiTokenDraft.set(value);
  }

  protected saveApiToken(): void {
    this.serverSettingsService.setApiToken(this.apiTokenDraft());
    const stored = this.serverSettingsService.getApiToken() ?? '';
    this.apiTokenDraft.set(stored);
    this.hasStoredApiToken.set(!!stored);
    this.feedback.success(
      stored ? 'API token saved in this browser.' : 'API token cleared.',
    );
  }

  protected refreshStatus(showToast = false): void {
    if (this.statusRequestInFlight) {
      if (showToast) {
        // Keep the button responsive: show busy state and run a real refresh when the silent one ends.
        this.pendingUserStatusRefresh = true;
        this.statusRefreshing.set(true);
      }
      return;
    }

    const hadStatus = this.status() !== null;

    if (!hadStatus) {
      this.statusError.set(null);
    }

    this.statusRequestInFlight = true;
    // Only the explicit Refresh click should toggle the button — silent open/reloads must not stutter it.
    if (showToast) {
      this.statusRefreshing.set(true);
    }

    this.http
      .get<AppStatus>('/api/status')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (body) => {
          this.status.set(body);
          this.statusError.set(null);
          this.statusRequestInFlight = false;

          if (this.pendingUserStatusRefresh) {
            this.pendingUserStatusRefresh = false;
            this.statusRefreshing.set(false);
            this.refreshStatus(true);
            return;
          }

          this.statusRefreshing.set(false);

          if (showToast) {
            this.feedback.success('Server status refreshed.');
          }
        },
        error: () => {
          if (!hadStatus) {
            this.statusError.set('Could not load server status.');
          }

          this.statusRequestInFlight = false;

          if (this.pendingUserStatusRefresh) {
            this.pendingUserStatusRefresh = false;
            this.statusRefreshing.set(false);
            this.refreshStatus(true);
            return;
          }

          this.statusRefreshing.set(false);

          if (showToast) {
            this.feedback.error('Could not refresh server status.');
          }
        },
      });
  }

  protected async reloadEvaluations(): Promise<void> {
    await this.evaluationService.loadFromApi();
    const error = this.evaluationService.loadError();

    if (error) {
      this.feedback.error(error);
      return;
    }

    const count = this.evaluationCount();
    this.feedback.success(
      `Reloaded ${count} ${count === 1 ? 'evaluation' : 'evaluations'}.`,
    );
  }

  protected async resetPreferences(): Promise<void> {
    const envDefault = this.envDefaultLlmPreset();
    const envLabel = envDefault ? formatLlmPreset(envDefault) : 'the .env default';

    const confirmed = window.confirm(
      `Reset all app preferences?\n\n` +
        `Resets: theme, rubric default, automation preferences, server LLM preset → ${envLabel}.\n\n` +
        `Does not reset: evaluations, database data, API keys, or your .env file.`,
    );

    if (!confirmed) {
      return;
    }

    this.settingsService.resetAll();
    const presetReset = await this.serverSettingsService.resetToEnvDefault();
    this.refreshStatus();

    if (presetReset) {
      this.feedback.success('All preferences reset to defaults.');
    } else {
      this.feedback.error(
        'Local preferences were reset, but the server performance preset could not be restored.',
      );
    }
  }

  protected mongoStatusLabel(mongo: MongoStatus): string {
    if (mongo.ok) {
      return mongo.dbName;
    }

    return sanitizeProviderReason(mongo.reason);
  }

  protected providerStatusLabel(probe: ProviderProbeStatus): string {
    if (probe.status === 'ready') {
      return probe.answerModels.join(', ');
    }

    return sanitizeProviderReason(probe.reason);
  }

  private ensureEvaluationsLoaded(): void {
    if (
      this.evaluationsLoadRequested ||
      this.evaluationService.loading() ||
      this.evaluationService.evaluations().length > 0
    ) {
      return;
    }

    this.evaluationsLoadRequested = true;
    void this.evaluationService.loadFromApi();
  }

  /** Load panel data once per open (shown event and already-visible fallback share this). */
  private ensurePanelDataForCurrentOpen(): void {
    if (!this.settingsService.isOpen() || this.panelDataLoadedForOpen) {
      return;
    }

    this.panelDataLoadedForOpen = true;
    this.ensureEvaluationsLoaded();
    void this.serverSettingsService.load({ soft: true, skipIfCached: true });
    this.refreshStatus(false);
  }
}
