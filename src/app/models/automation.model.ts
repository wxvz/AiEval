import { Evaluation } from './evaluation.model';

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
  | { type: 'error'; message: string; step: string };

export function automationProgressLabel(event: AutomationProgressEvent): string {
  switch (event.type) {
    case 'provider_resolved':
      return `Using ${event.provider} (${event.models.join(', ')})`;
    case 'provider_fallback':
      return `Switching provider: ${event.from} → ${event.to}`;
    case 'generating':
      return `Generating ${event.modelLabel} (${event.index}/${event.total})…`;
    case 'answer_generated':
      return `Generated answer: ${event.label}`;
    case 'scoring':
      return `Scoring ${event.label}…`;
    case 'scored':
      return `Scored answer (${event.totalPoints} pts)`;
    case 'winner_picked':
      return `Winner: ${event.label}`;
    case 'improved_generating':
      return 'Drafting improved answer…';
    case 'improved_done':
      return 'Improved answer ready';
    case 'complete':
      return 'Automation complete';
    case 'error':
      return `Error: ${event.message}`;
  }
}
