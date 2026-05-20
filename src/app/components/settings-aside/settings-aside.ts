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
import { RouterLink } from '@angular/router';

import { AppStatus, CriteriaMode, MongoStatus, ProviderProbeStatus } from '../../models';
import { EvaluationService } from '../../services/evaluation.service';
import {
  AutomationProviderPreference,
  SettingsService,
} from '../../services/settings.service';
import { Theme, ThemeService } from '../../services/theme.service';
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
  private readonly themeService = inject(ThemeService);
  private readonly evaluationService = inject(EvaluationService);

  private readonly offcanvasElement = viewChild<ElementRef<HTMLElement>>('offcanvas');
  private evaluationsLoadRequested = false;

  protected readonly offcanvasId = OFFCANVAS_ID;
  protected readonly theme = this.themeService.theme;
  protected readonly defaultCriteriaMode = this.settingsService.defaultCriteriaMode;
  protected readonly automationProviderPreference =
    this.settingsService.automationProviderPreference;
  protected readonly autoDismissAutomationStatus =
    this.settingsService.autoDismissAutomationStatus;

  protected readonly statusLoading = signal(false);
  protected readonly statusError = signal<string | null>(null);
  protected readonly status = signal<AppStatus | null>(null);

  protected readonly leaderboardEntries = computed(() =>
    computeModelLeaderboard(this.evaluationService.evaluations()),
  );

  protected readonly formatProvider = formatProviderLabel;

  constructor() {
    effect(() => {
      if (!this.settingsService.isOpen()) {
        return;
      }

      untracked(() => this.ensureEvaluationsLoaded());
      this.loadStatus();
    });

    afterRenderEffect(() => {
      const element = this.offcanvasElement()?.nativeElement;

      if (!element) {
        return;
      }

      const instance = bootstrap.Offcanvas.getOrCreateInstance(element);

      if (this.settingsService.isOpen()) {
        instance.show();
      } else {
        instance.hide();
      }
    });

    afterNextRender(() => {
      const element = this.offcanvasElement()?.nativeElement;

      if (!element) {
        return;
      }

      const onHidden = () => {
        this.settingsService.close();
      };

      element.addEventListener('hidden.bs.offcanvas', onHidden);
      this.destroyRef.onDestroy(() => {
        element.removeEventListener('hidden.bs.offcanvas', onHidden);
      });
    });
  }

  protected setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  protected setDefaultCriteriaMode(mode: CriteriaMode): void {
    this.settingsService.setDefaultCriteriaMode(mode);
  }

  protected setAutomationProviderPreference(preference: AutomationProviderPreference): void {
    this.settingsService.setAutomationProviderPreference(preference);
  }

  protected setAutoDismissAutomationStatus(enabled: boolean): void {
    this.settingsService.setAutoDismissAutomationStatus(enabled);
  }

  protected refreshStatus(): void {
    this.loadStatus();
  }

  protected resetPreferences(): void {
    if (!window.confirm('Reset all app preferences to defaults?')) {
      return;
    }

    this.settingsService.resetAll();
    this.status.set(null);
    this.loadStatus();
  }

  protected mongoStatusLabel(mongo: MongoStatus): string {
    if (mongo.ok) {
      return `ok (${mongo.dbName})`;
    }

    return `unavailable (${mongo.reason})`;
  }

  protected providerStatusLabel(probe: ProviderProbeStatus): string {
    if (probe.status === 'ready') {
      return `ok — ${probe.answerModels.join(', ')}`;
    }

    return `unavailable (${probe.reason})`;
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

  private loadStatus(): void {
    this.statusLoading.set(true);
    this.statusError.set(null);

    this.http.get<AppStatus>('/api/status').subscribe({
      next: (body) => {
        this.status.set(body);
        this.statusLoading.set(false);
      },
      error: () => {
        this.statusError.set('Could not load server status.');
        this.statusLoading.set(false);
      },
    });
  }
}
