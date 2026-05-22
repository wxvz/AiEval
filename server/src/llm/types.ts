import type { Evaluation, TokenUsageTotals } from '../types/evaluation.js';

export type { TokenUsageTotals };

export interface LlmTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated?: boolean;
}

export type ProviderName = 'ollama' | 'groq' | 'openrouter' | 'gemini' | 'huggingface';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ModelRef {
  model: string;
  label: string;
}

export const DEFAULT_LLM_TEMPERATURE = 0.3;

export interface LlmCompleteOptions {
  json?: boolean;
  signal?: AbortSignal;
  temperature?: number;
}

export interface LlmCompletion {
  text: string;
  /** Populated when the provider routes to a different model (e.g. OpenRouter `openrouter/free`). */
  resolvedModel?: string;
  usage?: LlmTokenUsage;
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
  | { type: 'provider_resolved'; provider: string }
  | { type: 'provider_fallback'; from: string; to: string }
  | {
      type: 'slow_provider_prompt';
      runId: string;
      currentProvider: string;
      cloudProvider: string | null;
      elapsedLabel: string;
    }
  | { type: 'metadata_generated'; evaluation: Evaluation }
  | { type: 'generating'; modelLabel: string; index: number; total: number }
  | {
      type: 'step_paused';
      step: AutomationStep;
      reason: 'rate_limit';
      completed: number;
      pending: number;
    }
  | {
      type: 'model_fallback';
      step: AutomationStep;
      fromModel: string;
      toModel: string;
      slotIndex?: number;
    }
  | { type: 'answer_generated'; answerId: string; label: string }
  | { type: 'scoring_batch'; modelLabel: string }
  | { type: 'scoring'; answerId: string; label: string }
  | { type: 'scored'; answerId: string; totalPoints: number; notes?: string }
  | { type: 'winner_picked'; answerId: string; label: string }
  | { type: 'improved_generating'; modelLabel: string }
  | { type: 'improved_done' }
  | { type: 'token_usage'; usage: TokenUsageTotals }
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
