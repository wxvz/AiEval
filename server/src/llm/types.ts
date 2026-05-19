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

export interface LlmCompleteOptions {
  json?: boolean;
  signal?: AbortSignal;
}

export interface LlmCompletion {
  text: string;
  /** Populated when the provider routes to a different model (e.g. OpenRouter `openrouter/free`). */
  resolvedModel?: string;
}

export interface LlmProvider {
  readonly name: ProviderName;
  complete(
    model: string,
    messages: ChatMessage[],
    options?: LlmCompleteOptions,
  ): Promise<LlmCompletion>;
}

export interface ResolvedLlmSetup {
  providerName: ProviderName;
  provider: LlmProvider;
  answerModels: ModelRef[];
  judgeModel: ModelRef;
}

export type AutomationPhase = 'full' | 'generate' | 'score' | 'improved';

export type AutomationStep = 'generating' | 'scoring' | 'improved' | 'provider';

export type AutomationRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export function automationStatusFromError(
  message: string,
): Extract<AutomationRunStatus, 'failed' | 'cancelled'> {
  return message.toLowerCase().includes('cancelled') ? 'cancelled' : 'failed';
}

export type AutomationProgressEvent =
  | { type: 'provider_resolved'; provider: string; models: string[] }
  | { type: 'provider_fallback'; from: string; to: string }
  | {
      type: 'slow_provider_prompt';
      runId: string;
      currentProvider: string;
      cloudProvider: string | null;
      elapsedLabel: string;
    }
  | { type: 'generating'; modelLabel: string; index: number; total: number }
  | { type: 'answer_generated'; answerId: string; label: string }
  | { type: 'scoring'; answerId: string; label: string }
  | { type: 'scored'; answerId: string; totalPoints: number; notes?: string }
  | { type: 'winner_picked'; answerId: string; label: string }
  | { type: 'improved_generating' }
  | { type: 'improved_done' }
  | { type: 'status'; status: AutomationRunStatus; runId?: string }
  | { type: 'complete'; evaluation: Evaluation; status: 'completed' }
  | {
      type: 'error';
      message: string;
      step: AutomationStep;
      status: Extract<AutomationRunStatus, 'failed' | 'cancelled'>;
    };

export type ProgressCallback = (event: AutomationProgressEvent) => void;

export interface RunEvaluationOptions {
  runId: string;
  evaluationId: string;
  force: boolean;
  phase?: AutomationPhase;
  onProgress: ProgressCallback;
}
