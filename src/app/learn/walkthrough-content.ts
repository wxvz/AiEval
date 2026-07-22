import firstEvaluationLab from './content/first-evaluation-lab.json';
import type { WalkthroughContent } from './learn-content';

export function loadWalkthroughContent(): WalkthroughContent {
  return firstEvaluationLab as WalkthroughContent;
}

export function walkthroughHasSteps(): boolean {
  return loadWalkthroughContent().steps.length > 0;
}
