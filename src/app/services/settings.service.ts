import { Injectable, inject, signal } from '@angular/core';

import { CriteriaMode } from '../models';
import { ThemeService } from './theme.service';

export type AutomationProviderPreference = 'ask' | 'local' | 'cloud';

const PREFIX = 'aieval-settings-';

const KEYS = {
  defaultCriteriaMode: `${PREFIX}default-criteria-mode`,
  automationProviderPreference: `${PREFIX}automation-provider-preference`,
  autoDismissAutomationStatus: `${PREFIX}auto-dismiss-automation-status`,
  learnUnlockAll: `${PREFIX}learn-unlock-all`,
} as const;

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly openSignal = signal(false);

  readonly isOpen = this.openSignal.asReadonly();
  readonly defaultCriteriaMode = signal<CriteriaMode>(this.readCriteriaMode());
  readonly automationProviderPreference = signal<AutomationProviderPreference>(
    this.readProviderPreference(),
  );
  readonly autoDismissAutomationStatus = signal(this.readAutoDismiss());
  readonly learnUnlockAll = signal(this.readLearnUnlockAll());

  private readonly themeService = inject(ThemeService);

  open(): void {
    this.openSignal.set(true);
  }

  close(): void {
    this.openSignal.set(false);
  }

  setDefaultCriteriaMode(mode: CriteriaMode): void {
    this.defaultCriteriaMode.set(mode);
    localStorage.setItem(KEYS.defaultCriteriaMode, mode);
  }

  setAutomationProviderPreference(preference: AutomationProviderPreference): void {
    this.automationProviderPreference.set(preference);
    localStorage.setItem(KEYS.automationProviderPreference, preference);
  }

  setAutoDismissAutomationStatus(enabled: boolean): void {
    this.autoDismissAutomationStatus.set(enabled);
    localStorage.setItem(KEYS.autoDismissAutomationStatus, enabled ? 'true' : 'false');
  }

  setLearnUnlockAll(enabled: boolean): void {
    this.learnUnlockAll.set(enabled);
    localStorage.setItem(KEYS.learnUnlockAll, enabled ? 'true' : 'false');
  }

  resetAll(): void {
    Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
    this.defaultCriteriaMode.set('default');
    this.automationProviderPreference.set('ask');
    this.autoDismissAutomationStatus.set(false);
    this.learnUnlockAll.set(false);
    this.themeService.resetTheme();
  }

  private readCriteriaMode(): CriteriaMode {
    const stored = localStorage.getItem(KEYS.defaultCriteriaMode);

    return stored === 'custom' ? 'custom' : 'default';
  }

  private readProviderPreference(): AutomationProviderPreference {
    const stored = localStorage.getItem(KEYS.automationProviderPreference);

    if (stored === 'local' || stored === 'cloud') {
      return stored;
    }

    return 'ask';
  }

  private readAutoDismiss(): boolean {
    return localStorage.getItem(KEYS.autoDismissAutomationStatus) === 'true';
  }

  private readLearnUnlockAll(): boolean {
    return localStorage.getItem(KEYS.learnUnlockAll) === 'true';
  }
}
