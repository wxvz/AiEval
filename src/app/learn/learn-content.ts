import { normalizeCheckAnswer } from './check-answer';
import activationFunctions from './content/activation-functions.json';
import automationAndJudges from './content/automation-and-judges.json';
import biasAndWeights from './content/bias-and-weights.json';
import buildingEvalHarnesses from './content/building-eval-harnesses.json';
import comparingAnswers from './content/comparing-answers.json';
import controllingGeneration from './content/controlling-generation.json';
import dataLiteracy from './content/data-literacy.json';
import decisionTrees from './content/decision-trees.json';
import deepLearningApproaches from './content/deep-learning-approaches.json';
import faithfulnessAndHallucinations from './content/faithfulness-and-hallucinations.json';
import generativeAdversarialNetworks from './content/generative-adversarial-networks.json';
import goldenTestCases from './content/golden-test-cases.json';
import learningFromExamples from './content/learning-from-examples.json';
import lossAndUpdates from './content/loss-and-updates.json';
import mcp from './content/mcp.json';
import multimodalVectorDatabases from './content/multimodal-vector-databases.json';
import productionConcerns from './content/production-concerns.json';
import promptsAsInstructions from './content/prompts-as-instructions.json';
import reinforcementLearning from './content/reinforcement-learning.json';
import regressionEvals from './content/regression-evals.json';
import rubricsAndCriteria from './content/rubrics-and-criteria.json';
import semanticMemory from './content/semantic-memory.json';
import structuredOutputsForJudges from './content/structured-outputs-for-judges.json';
import toolCalling from './content/tool-calling.json';
import trainVsTest from './content/train-vs-test.json';
import transformersOverview from './content/transformers-overview.json';
import whatIsADataset from './content/what-is-a-dataset.json';

export interface LessonReveal {
  prompt: string;
  reveal: string;
}

export interface LessonAside {
  title: string;
  body: string;
  route?: string;
  actionLabel?: string;
}

export interface LessonSection {
  heading?: string;
  title?: string;
  paragraphs: string[];
  bullets?: string[];
  reveals?: LessonReveal[];
  check?: CheckQuestion;
  aside?: LessonAside;
}

export interface CheckQuestion {
  prompt: string;
  answer: string;
  accept?: string[];
  choices?: string[];
  /** Word chips the learner taps to assemble the answer (used when no choices). */
  wordBank?: string[];
  explanation: string;
}

export interface LessonContent {
  sections: LessonSection[];
  recapQuestions: CheckQuestion[];
  checkQuestions?: CheckQuestion[];
}

export interface LessonContentValidationIssue {
  lessonId: string;
  message: string;
}

const FULL_RECAP_LESSON_IDS = new Set([
  'learning-from-examples',
  'what-is-a-dataset',
  'train-vs-test',
  'loss-and-updates',
  'bias-and-weights',
  'activation-functions',
  'data-literacy',
  'decision-trees',
  'deep-learning-approaches',
  'semantic-memory',
  'transformers-overview',
  'tool-calling',
  'mcp',
  'multimodal-vector-databases',
  'reinforcement-learning',
  'generative-adversarial-networks',
]);

export interface WalkthroughStep {
  title: string;
  body: string;
  actionLabel: string;
  actionRoute: string;
}

export interface WalkthroughHandoffCopy {
  createPageHint: string;
  dashboardBanner: string;
}

export interface WalkthroughContent {
  steps: WalkthroughStep[];
  handoffCopy?: WalkthroughHandoffCopy;
}

export interface HubCopy {
  subtitle: string;
  toolsLabel: string;
  tracks: Record<string, string>;
}

const LESSON_CONTENT: Record<string, LessonContent> = {
  'learning-from-examples': learningFromExamples,
  'what-is-a-dataset': whatIsADataset,
  'train-vs-test': trainVsTest,
  'loss-and-updates': lossAndUpdates,
  'bias-and-weights': biasAndWeights,
  'activation-functions': activationFunctions,
  'data-literacy': dataLiteracy,
  'decision-trees': decisionTrees,
  'deep-learning-approaches': deepLearningApproaches,
  'prompts-as-instructions': promptsAsInstructions,
  'controlling-generation': controllingGeneration,
  'comparing-answers': comparingAnswers,
  'golden-test-cases': goldenTestCases,
  'rubrics-and-criteria': rubricsAndCriteria,
  'structured-outputs-for-judges': structuredOutputsForJudges,
  'semantic-memory': semanticMemory,
  'faithfulness-and-hallucinations': faithfulnessAndHallucinations,
  'regression-evals': regressionEvals,
  'automation-and-judges': automationAndJudges,
  'transformers-overview': transformersOverview,
  'tool-calling': toolCalling,
  mcp,
  'multimodal-vector-databases': multimodalVectorDatabases,
  'reinforcement-learning': reinforcementLearning,
  'generative-adversarial-networks': generativeAdversarialNetworks,
  'production-concerns': productionConcerns,
  'building-eval-harnesses': buildingEvalHarnesses,
};

export function getContentLessonIds(): Set<string> {
  return new Set(Object.keys(LESSON_CONTENT));
}

export function loadLessonContent(lessonId: string): LessonContent | null {
  return LESSON_CONTENT[lessonId] ?? null;
}

export function lessonHasBody(lessonId: string): boolean {
  const content = loadLessonContent(lessonId);
  return (content?.sections.length ?? 0) > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateCheckQuestion(
  question: CheckQuestion | undefined,
  label: string,
): string | null {
  if (!question) {
    return `${label} is missing`;
  }
  if (!isNonEmptyString(question.prompt)) {
    return `${label} prompt is empty`;
  }
  if (!isNonEmptyString(question.answer)) {
    return `${label} answer is empty`;
  }
  if (!isNonEmptyString(question.explanation)) {
    return `${label} explanation is empty`;
  }
  const hasChoices = (question.choices?.length ?? 0) > 0;
  const hasWordBank = (question.wordBank?.length ?? 0) > 0;
  if (!hasChoices && !hasWordBank) {
    return `${label} needs choices or a wordBank`;
  }
  if (hasWordBank) {
    const bankTokens = new Set(
      question.wordBank!.flatMap((word) => normalizeCheckAnswer(word).split(' ')),
    );
    const missing = normalizeCheckAnswer(question.answer)
      .split(' ')
      .filter((token) => token && !bankTokens.has(token));
    if (missing.length > 0) {
      return `${label} wordBank is missing answer words: ${missing.join(', ')}`;
    }
  }
  return null;
}

function validateAside(aside: LessonAside | undefined, label: string): string | null {
  if (!aside) {
    return null;
  }
  if (!isNonEmptyString(aside.title)) {
    return `${label} aside title is empty`;
  }
  if (!isNonEmptyString(aside.body)) {
    return `${label} aside body is empty`;
  }
  return null;
}

export function validateLessonContent(lessonId: string, content: LessonContent): LessonContentValidationIssue[] {
  const issues: LessonContentValidationIssue[] = [];

  if (content.sections.length === 0) {
    return issues;
  }

  for (let index = 0; index < content.sections.length; index++) {
    const section = content.sections[index]!;
    const checkIssue = validateCheckQuestion(section.check, `Section ${index + 1} check`);
    if (checkIssue) {
      issues.push({ lessonId, message: checkIssue });
    }
    const asideIssue = validateAside(section.aside, `Section ${index + 1}`);
    if (asideIssue) {
      issues.push({ lessonId, message: asideIssue });
    }
  }

  if (FULL_RECAP_LESSON_IDS.has(lessonId)) {
    if (content.recapQuestions.length !== 2) {
      issues.push({
        lessonId,
        message: `Expected 2 recap questions, found ${content.recapQuestions.length}`,
      });
    }
    for (let index = 0; index < content.recapQuestions.length; index++) {
      const recapIssue = validateCheckQuestion(
        content.recapQuestions[index],
        `Recap question ${index + 1}`,
      );
      if (recapIssue) {
        issues.push({ lessonId, message: recapIssue });
      }
    }
  }

  return issues;
}

export function validateAllLessonContent(): LessonContentValidationIssue[] {
  const issues: LessonContentValidationIssue[] = [];
  for (const [lessonId, content] of Object.entries(LESSON_CONTENT)) {
    issues.push(...validateLessonContent(lessonId, content));
  }
  return issues;
}

export { loadWalkthroughContent, walkthroughHasSteps } from './walkthrough-content';
