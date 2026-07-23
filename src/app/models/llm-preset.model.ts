export type LlmPreset = 'balanced' | 'fast';

export interface ServerSettings {
  llmPreset: LlmPreset;
  envDefaultLlmPreset: LlmPreset;
  apiTokenRequired: boolean;
}
