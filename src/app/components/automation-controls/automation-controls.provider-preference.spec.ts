import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsService } from '../../services/settings.service';
import { AutomationControlsComponent } from './automation-controls';

describe('AutomationControlsComponent provider preference', () => {
  let settingsService: SettingsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    settingsService = TestBed.inject(SettingsService);
  });

  function promptProviderChoice(preference: 'ask' | 'local' | 'cloud') {
    settingsService.setAutomationProviderPreference(preference);
    const component = TestBed.runInInjectionContext(() => new AutomationControlsComponent());
    const event = {
      type: 'slow_provider_prompt' as const,
      currentProvider: 'ollama',
      cloudProvider: 'groq',
      elapsedLabel: '3 minutes',
    };

    return (component as unknown as { promptProviderChoice: (e: typeof event) => Promise<boolean> })
      .promptProviderChoice(event);
  }

  it('prefers local without opening the modal', async () => {
    await expect(promptProviderChoice('local')).resolves.toBe(false);
  });

  it('prefers cloud when a cloud provider is available', async () => {
    await expect(promptProviderChoice('cloud')).resolves.toBe(true);
  });

  it('falls back to the modal flow when preference is ask', async () => {
    const component = TestBed.runInInjectionContext(() => new AutomationControlsComponent());
    const prompt = (
      component as unknown as {
        promptProviderChoice: (event: {
          type: 'slow_provider_prompt';
          currentProvider: string;
          cloudProvider: string;
          elapsedLabel: string;
        }) => Promise<boolean>;
      }
    ).promptProviderChoice.bind(component);

    vi.spyOn(document, 'getElementById').mockReturnValue(null);

    await expect(
      prompt({
        type: 'slow_provider_prompt',
        currentProvider: 'ollama',
        cloudProvider: 'groq',
        elapsedLabel: '3 minutes',
      }),
    ).resolves.toBe(false);
  });
});
