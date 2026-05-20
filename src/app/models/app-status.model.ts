export type ProviderName = 'ollama' | 'groq' | 'openrouter' | 'gemini' | 'huggingface';

export type ProviderProbeStatus =
  | {
      name: ProviderName;
      status: 'ready';
      answerModels: string[];
      judgeModel: string;
    }
  | { name: ProviderName; status: 'unavailable'; reason: string };

export type MongoStatus = { ok: true; dbName: string } | { ok: false; dbName: string; reason: string };

export interface AppStatus {
  mongo: MongoStatus;
  llmPreset: 'balanced' | 'fast';
  providers: ProviderProbeStatus[];
  activeProvider: {
    name: ProviderName;
    answerModels: string[];
    judgeModel: string;
  } | null;
}
