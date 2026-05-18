import type { Evaluation } from '../types/evaluation.js';

export type ProviderName = 'ollama' | 'groq' | 'openrouter' | 'gemini' | 'huggingface';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelRef {
  model: string;
  label: string;
}

export interface LlmProvider {
  readonly name: ProviderName;
  complete(model: string, messages: ChatMessage[], options?: { json?: boolean }): Promise<string>;
}

export interface ResolvedLlmSetup {
  providerName: ProviderName;
  provider: LlmProvider;
  answerModels: ModelRef[];
  judgeModel: ModelRef;
}

export type AutomationStep = 'generating' | 'scoring' | 'improved' | 'provider';

export type AutomationProgressEvent =
  | { type: 'provider_resolved'; provider: string; models: string[] }
  | { type: 'provider_fallback'; from: string; to: string }
  | { type: 'generating'; modelLabel: string; index: number; total: number }
  | { type: 'answer_generated'; answerId: string; label: string }
  | { type: 'scoring'; answerId: string; label: string }
  | { type: 'scored'; answerId: string; totalPoints: number }
  | { type: 'winner_picked'; answerId: string; label: string }
  | { type: 'improved_generating' }
  | { type: 'improved_done' }
  | { type: 'complete'; evaluation: Evaluation }
  | { type: 'error'; message: string; step: AutomationStep };

export type ProgressCallback = (event: AutomationProgressEvent) => void;

export interface RunEvaluationOptions {
  runId: string;
  evaluationId: string;
  force: boolean;
  onProgress: ProgressCallback;
}
