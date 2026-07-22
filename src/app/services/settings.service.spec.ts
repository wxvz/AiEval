import { TestBed } from '@angular/core/testing';

import { SettingsService } from './settings.service';
import { ThemeService } from './theme.service';

describe('SettingsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('loads defaults from localStorage', () => {
    localStorage.setItem('aieval-settings-default-criteria-mode', 'custom');
    localStorage.setItem('aieval-settings-automation-provider-preference', 'local');
    localStorage.setItem('aieval-settings-auto-dismiss-automation-status', 'true');

    const service = TestBed.inject(SettingsService);

    expect(service.defaultCriteriaMode()).toBe('custom');
    expect(service.automationProviderPreference()).toBe('local');
    expect(service.autoDismissAutomationStatus()).toBe(true);
  });

  it('persists preference changes', () => {
    const service = TestBed.inject(SettingsService);

    service.setDefaultCriteriaMode('custom');
    service.setAutomationProviderPreference('cloud');
    service.setAutoDismissAutomationStatus(true);
    service.setLearnUnlockAll(true);

    expect(localStorage.getItem('aieval-settings-default-criteria-mode')).toBe('custom');
    expect(localStorage.getItem('aieval-settings-automation-provider-preference')).toBe('cloud');
    expect(localStorage.getItem('aieval-settings-auto-dismiss-automation-status')).toBe('true');
    expect(localStorage.getItem('aieval-settings-learn-unlock-all')).toBe('true');
  });

  it('resetAll clears settings keys and resets theme', () => {
    localStorage.setItem('aieval-theme', 'dark');
    localStorage.setItem('aieval-settings-default-criteria-mode', 'custom');

    const service = TestBed.inject(SettingsService);
    const themeService = TestBed.inject(ThemeService);

    service.resetAll();

    expect(localStorage.getItem('aieval-settings-default-criteria-mode')).toBeNull();
    expect(localStorage.getItem('aieval-theme')).toBeNull();
    expect(service.defaultCriteriaMode()).toBe('default');
    expect(themeService.theme()).toBe('system');
    expect(service.learnUnlockAll()).toBe(false);
  });
});
