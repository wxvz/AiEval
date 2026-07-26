import firstEvaluationLab from './content/first-evaluation-lab.json';
import supportBotDecisionLab from './content/support-bot-decision-lab.json';
import type { WalkthroughContent } from './learn-content';

const WALKTHROUGHS: Record<string, WalkthroughContent> = {
  'first-evaluation-lab': firstEvaluationLab as WalkthroughContent,
  'support-bot-decision-lab': supportBotDecisionLab as WalkthroughContent,
};

const EMPTY_WALKTHROUGH: WalkthroughContent = { steps: [] };

export function loadWalkthroughContent(lessonId: string): WalkthroughContent {
  return WALKTHROUGHS[lessonId] ?? EMPTY_WALKTHROUGH;
}

export function walkthroughHasSteps(lessonId: string): boolean {
  return loadWalkthroughContent(lessonId).steps.length > 0;
}
