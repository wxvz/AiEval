export const LogEvents = {
  httpRequest: 'http.request',
  httpError: 'http.error',
  startupPreflight: 'startup.preflight',
  automationStarted: 'automation.started',
  automationProviderResolved: 'automation.provider_resolved',
  automationProviderFallback: 'automation.provider_fallback',
  automationGenerating: 'automation.generating',
  automationAnswerGenerated: 'automation.answer_generated',
  /** Slot attempt failed (rate limit, empty/unusable content) — not a successful answer. */
  automationAnswerRejected: 'automation.answer_rejected',
  /** Switching to another model after a rejected/failed slot attempt. */
  automationModelFallback: 'automation.model_fallback',
  automationScoring: 'automation.scoring',
  automationScored: 'automation.scored',
  automationWinnerPicked: 'automation.winner_picked',
  automationImprovedGenerating: 'automation.improved_generating',
  automationImprovedDone: 'automation.improved_done',
  automationPipelineStep: 'automation.pipeline_step',
  automationComplete: 'automation.complete',
  automationCancelled: 'automation.cancelled',
  automationFailed: 'automation.failed',
  automationProviderChoice: 'automation.provider_choice',
  llmRequest: 'llm.request',
  llmPrompt: 'llm.prompt',
  llmResponse: 'llm.response',
  llmCallFailed: 'llm.call_failed',
  llmRetry: 'llm.retry',
  llmRateLimit: 'llm.rate_limit',
  llmSlowFallback: 'llm.slow_fallback',
  /** Live overlay differs from frozen setup.preset used for fallback chains. */
  llmPresetMismatch: 'llm.preset_mismatch',
  sseEvent: 'sse.event',
  learnChatTruncated: 'learn_chat.truncated',
  learnChatRateLimited: 'learn_chat.rate_limited',
} as const;

export type LogEventName = (typeof LogEvents)[keyof typeof LogEvents];

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  runId?: string;
  evaluationId?: string;
  provider?: string;
  model?: string;
  step?: string;
  durationMs?: number;
  answerId?: string;
  message?: string;
  attempt?: number;
  force?: boolean;
  preset?: string;
  [key: string]: unknown;
}
