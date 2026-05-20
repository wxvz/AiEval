import { AutomationProviderPreference } from '../services/settings.service';
import { CriteriaMode } from '../models';
import { LlmPreset } from '../models/llm-preset.model';
import { Theme } from '../services/theme.service';

export type ServerStatTone = 'success' | 'danger';

export function serverStatTone(ok: boolean): ServerStatTone {
  return ok ? 'success' : 'danger';
}

export function formatLlmPreset(preset: LlmPreset): string {
  return preset === 'fast' ? 'Fast' : 'Balanced';
}

export function formatTheme(theme: Theme): string {
  switch (theme) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    default:
      return 'System';
  }
}

export function formatCriteriaMode(mode: CriteriaMode): string {
  return mode === 'custom' ? 'Custom' : 'Built-in';
}

export function formatAutomationPreference(
  preference: AutomationProviderPreference,
): string {
  switch (preference) {
    case 'local':
      return 'Prefer local';
    case 'cloud':
      return 'Prefer cloud';
    default:
      return 'Ask each time';
  }
}

export function formatAutoDismiss(enabled: boolean): string {
  return enabled ? 'On' : 'Off';
}

export function serverAggregateReady(
  mongoOk: boolean,
  hasActiveProvider: boolean,
): boolean {
  return mongoOk && hasActiveProvider;
}

export function serverAggregateMessage(
  mongoOk: boolean,
  hasActiveProvider: boolean,
  mongoReason?: string,
): string {
  if (mongoOk && hasActiveProvider) {
    return 'Ready to evaluate';
  }

  if (!mongoOk) {
    return mongoReason ? `Not ready — ${mongoReason}` : 'Not ready — database unavailable';
  }

  return 'Not ready — no LLM provider available';
}

export function sanitizeProviderReason(reason: string): string {
  return reason
    .replace(/\bGROQ_API_KEY\b/gi, 'API key')
    .replace(/\bOPENROUTER_API_KEY\b/gi, 'API key')
    .replace(/\bGEMINI_API_KEY\b/gi, 'API key')
    .replace(/\bHUGGINGFACE_API_KEY\b/gi, 'API key')
    .replace(/\bMONGODB_URI\b/gi, 'database URL')
    .replace(/\bOLLAMA_BASE_URL\b/gi, 'Ollama URL');
}

export function automationPreferenceHint(
  preference: AutomationProviderPreference,
  activeProviderName: string | undefined,
): string | null {
  if (!activeProviderName) {
    return null;
  }

  const isLocal = activeProviderName === 'ollama';

  if (preference === 'cloud' && isLocal) {
    return 'Using local — no cloud provider available.';
  }

  if (preference === 'local' && !isLocal) {
    return 'Using cloud — local Ollama is not available.';
  }

  return null;
}
