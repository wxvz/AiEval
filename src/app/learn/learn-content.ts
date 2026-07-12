import automationAndJudges from './content/automation-and-judges.json';
import buildingEvalHarnesses from './content/building-eval-harnesses.json';
import comparingAnswers from './content/comparing-answers.json';
import controllingGeneration from './content/controlling-generation.json';
import faithfulnessAndHallucinations from './content/faithfulness-and-hallucinations.json';
import firstEvaluationLab from './content/first-evaluation-lab.json';
import goldenTestCases from './content/golden-test-cases.json';
import hub from './content/hub.json';
import learningFromExamples from './content/learning-from-examples.json';
import lossAndUpdates from './content/loss-and-updates.json';
import productionConcerns from './content/production-concerns.json';
import promptsAsInstructions from './content/prompts-as-instructions.json';
import regressionEvals from './content/regression-evals.json';
import rubricsAndCriteria from './content/rubrics-and-criteria.json';
import semanticMemory from './content/semantic-memory.json';
import structuredOutputsForJudges from './content/structured-outputs-for-judges.json';
import trainVsTest from './content/train-vs-test.json';
import transformersOverview from './content/transformers-overview.json';

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
  'train-vs-test',
  'loss-and-updates',
  'semantic-memory',
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
  'train-vs-test': trainVsTest,
  'loss-and-updates': lossAndUpdates,
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
  'production-concerns': productionConcerns,
  'building-eval-harnesses': buildingEvalHarnesses,
};

export const HUB_COPY = hub as HubCopy;

export function getContentLessonIds(): Set<string> {
  return new Set(Object.keys(LESSON_CONTENT));
}

export function loadLessonContent(lessonId: string): LessonContent | null {
  return LESSON_CONTENT[lessonId] ?? null;
}

export function loadWalkthroughContent(): WalkthroughContent {
  return firstEvaluationLab as WalkthroughContent;
}

export function lessonHasBody(lessonId: string): boolean {
  const content = loadLessonContent(lessonId);
  return (content?.sections.length ?? 0) > 0;
}

export function walkthroughHasSteps(): boolean {
  return loadWalkthroughContent().steps.length > 0;
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
