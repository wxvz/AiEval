import { Evaluation } from './evaluation.model';
import { TokenUsageTotals } from './token-usage.model';

export type AutomationPhase = 'full' | 'generate' | 'score' | 'improved';

/** Terminal and in-flight automation states surfaced in the UI and SSE stream. */
export type AutomationRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/** UI state for the automation status card on the edit evaluation page. */
export type AutomationOutcomeStatus = AutomationRunStatus | 'idle';

export interface AutomationOutcome {
  status: AutomationOutcomeStatus;
}

export const idleAutomationOutcome = (): AutomationOutcome => ({ status: 'idle' });

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
  | { type: 'metadata_generated'; evaluation: Evaluation }
  | { type: 'generating'; modelLabel: string; index: number; total: number }
  | {
      type: 'step_paused';
      step: string;
      reason: 'rate_limit';
      completed: number;
      pending: number;
    }
  | {
      type: 'model_fallback';
      step: string;
      fromModel: string;
      toModel: string;
      slotIndex?: number;
    }
  | { type: 'answer_generated'; answerId: string; label: string }
  | { type: 'scoring'; answerId: string; label: string }
  | { type: 'scored'; answerId: string; totalPoints: number; notes?: string }
  | { type: 'winner_picked'; answerId: string; label: string }
  | { type: 'improved_generating' }
  | { type: 'improved_done' }
  | { type: 'token_usage'; usage: TokenUsageTotals }
  | { type: 'status'; status: AutomationRunStatus; runId?: string }
  | { type: 'complete'; evaluation: Evaluation; status: 'completed' }
  | {
      type: 'error';
      message: string;
      step: string;
      status: Extract<AutomationRunStatus, 'failed' | 'cancelled'>;
    };

export function automationProgressLabel(event: AutomationProgressEvent): string {
  switch (event.type) {
    case 'provider_resolved':
      return `Using ${event.provider} (${event.models.join(', ')})`;
    case 'provider_fallback':
      return `Switching provider: ${event.from} → ${event.to}`;
    case 'slow_provider_prompt':
      return event.cloudProvider
        ? `Waiting: use ${event.cloudProvider} or keep ${event.currentProvider}?`
        : `Waiting: keep using ${event.currentProvider}?`;
    case 'metadata_generated':
      return 'Title and prompt ready';
    case 'generating':
      return `Generating ${event.modelLabel} (${event.index}/${event.total})…`;
    case 'step_paused':
      return `Paused (${event.completed} done, ${event.pending} pending) — retrying after rate limit…`;
    case 'model_fallback':
      return event.slotIndex !== undefined
        ? `Retrying slot ${event.slotIndex + 1} with ${event.toModel} (was ${event.fromModel})`
        : `Retrying with ${event.toModel} (was ${event.fromModel})`;
    case 'answer_generated':
      return `Generated answer: ${event.label}`;
    case 'scoring':
      return `Scoring ${event.label}…`;
    case 'scored':
      return event.notes
        ? `Scored answer (${event.totalPoints} pts): ${event.notes}`
        : `Scored answer (${event.totalPoints} pts)`;
    case 'winner_picked':
      return `Winner: ${event.label}`;
    case 'improved_generating':
      return 'Drafting improved answer…';
    case 'improved_done':
      return 'Improved answer ready';
    case 'token_usage':
      return `Tokens: ${event.usage.totalTokens.toLocaleString()}${event.usage.estimated ? ' (est.)' : ''}`;
    case 'status':
      return '';
    case 'complete':
      return 'Automation complete';
    case 'error':
      return `Error: ${event.message}`;
  }
}
