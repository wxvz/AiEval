import { config } from './config.js';

export type LlmPreset = 'balanced' | 'fast';

const envDefaultLlmPreset: LlmPreset = config.llmPreset;
let llmPresetOverlay: LlmPreset | null = null;

export function getEnvDefaultLlmPreset(): LlmPreset {
  return envDefaultLlmPreset;
}

export function getLlmPreset(): LlmPreset {
  return llmPresetOverlay ?? envDefaultLlmPreset;
}

export function setLlmPreset(preset: LlmPreset): void {
  llmPresetOverlay = preset;
}

export function resetLlmPresetToEnvDefault(): void {
  llmPresetOverlay = null;
}

export function isValidLlmPreset(value: unknown): value is LlmPreset {
  return value === 'balanced' || value === 'fast';
}
