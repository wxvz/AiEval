import { describe, expect, it } from 'vitest';

import {
  getLiveLessons,
  getNextLesson,
  getLesson,
  getHubLessonsForTrack,
  getOptionalLabForLesson,
  isLessonLocked,
  validateCurriculum,
} from './curriculum';
import { getContentLessonIds } from './learn-content';

describe('curriculum', () => {
  it('passes validateCurriculum', () => {
    const issues = validateCurriculum(getContentLessonIds());
    expect(issues).toEqual([]);
  });

  it('orders live lessons foundation reads before neural-network-lab', () => {
    const live = getLiveLessons();
    const nnIndex = live.findIndex((lesson) => lesson.id === 'neural-network-lab');
    const readIds = live
      .slice(0, nnIndex)
      .filter((lesson) => lesson.trackId === 'foundation' && lesson.kind === 'read')
      .map((lesson) => lesson.id);
    expect(readIds).toEqual([
      'learning-from-examples',
      'what-is-a-dataset',
      'train-vs-test',
      'loss-and-updates',
      'learning-rate',
      'bias-and-weights',
      'activation-functions',
      'softmax-and-distributions',
    ]);
  });

  it('keeps the neural spine after the neural-network lab without trees/RL/GANs', () => {
    const foundationIds = getLiveLessons()
      .filter((lesson) => lesson.trackId === 'foundation')
      .map((lesson) => lesson.id);
    const nnIndex = foundationIds.indexOf('neural-network-lab');
    expect(foundationIds.slice(nnIndex)).toEqual([
      'neural-network-lab',
      'embeddings-and-representations',
      'data-literacy',
      'deep-learning-approaches',
      'tokenization-inside-models',
    ]);
    expect(getLesson('deep-learning-approaches')?.prerequisites).toEqual(['data-literacy']);
    expect(getLesson('prompts-as-instructions')?.prerequisites).toEqual(['tokenization-inside-models']);
  });

  it('keeps optional labs and demoted branches off the hub track list', () => {
    const hubIds = getHubLessonsForTrack('foundation').map((lesson) => lesson.id);
    expect(hubIds).toEqual([
      'learning-from-examples',
      'what-is-a-dataset',
      'train-vs-test',
      'loss-and-updates',
      'learning-rate',
      'bias-and-weights',
      'activation-functions',
      'softmax-and-distributions',
      'neural-network-lab',
      'embeddings-and-representations',
      'data-literacy',
      'deep-learning-approaches',
      'tokenization-inside-models',
      'residual-connections',
    ]);
    expect(hubIds).not.toContain('decision-trees');
    expect(hubIds).not.toContain('reinforcement-learning');
    expect(hubIds).not.toContain('generative-adversarial-networks');
    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('train-vs-test-lab');
    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('decision-trees');
    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('reinforcement-learning-lab');
  });

  it('demotes trees, RL and GANs to optional side branches', () => {
    expect(getLesson('decision-trees')?.optional).toBe(true);
    expect(getLesson('decision-trees')?.parentLessonId).toBe('data-literacy');
    expect(getLesson('decision-trees-lab')?.optional).toBe(true);
    expect(getLesson('reinforcement-learning')?.optional).toBe(true);
    expect(getLesson('reinforcement-learning')?.parentLessonId).toBe('deep-learning-approaches');
    expect(getLesson('reinforcement-learning-lab')?.optional).toBe(true);
    expect(getLesson('generative-adversarial-networks')?.optional).toBe(true);
    expect(getLesson('generative-adversarial-networks')?.parentLessonId).toBe(
      'reinforcement-learning-lab',
    );
  });

  it('links optional labs to parent read lessons', () => {
    expect(getOptionalLabForLesson('train-vs-test')?.route).toBe('/learn/labs/train-vs-test');
    expect(getOptionalLabForLesson('loss-and-updates')?.route).toBe('/learn/labs/loss-and-updates');
    expect(getOptionalLabForLesson('learning-rate')?.route).toBe('/learn/labs/learning-rate');
    expect(getOptionalLabForLesson('softmax-and-distributions')?.route).toBe('/learn/labs/softmax');
    expect(getOptionalLabForLesson('semantic-memory')?.route).toBe('/learn/labs/semantic-memory');
    expect(getOptionalLabForLesson('controlling-generation')?.route).toBe('/learn/labs/controlling-generation');
    expect(getOptionalLabForLesson('structured-outputs-for-judges')?.route).toBe('/learn/labs/judge-json');
    expect(getOptionalLabForLesson('faithfulness-and-hallucinations')?.route).toBe('/learn/labs/faithfulness');
    expect(getOptionalLabForLesson('learning-from-examples')?.route).toBe('/learn/labs/learning-from-examples');
    expect(getOptionalLabForLesson('what-is-a-dataset')?.route).toBe('/learn/labs/what-is-a-dataset');
    expect(getOptionalLabForLesson('activation-functions')?.route).toBe('/learn/labs/activation-functions');
    expect(getOptionalLabForLesson('comparing-answers')?.route).toBe('/learn/labs/comparing-answers');
    expect(getOptionalLabForLesson('rubrics-and-criteria')?.route).toBe('/learn/labs/rubrics-and-criteria');
    expect(getOptionalLabForLesson('data-literacy')?.id).toBe('decision-trees');
    expect(getOptionalLabForLesson('deep-learning-approaches')?.id).toBe('reinforcement-learning');
  });

  it('keeps new optional labs off the hub track lists', () => {
    const foundationIds = getHubLessonsForTrack('foundation').map((lesson) => lesson.id);
    const llmIds = getHubLessonsForTrack('llm-systems').map((lesson) => lesson.id);
    expect(foundationIds).not.toContain('learning-from-examples-lab');
    expect(foundationIds).not.toContain('what-is-a-dataset-lab');
    expect(foundationIds).not.toContain('learning-rate-lab');
    expect(foundationIds).not.toContain('softmax-and-distributions-lab');
    expect(llmIds).not.toContain('comparing-answers-lab');
    expect(llmIds).not.toContain('rubrics-and-criteria-lab');
    expect(getLesson('comparing-answers-lab')?.optional).toBe(true);
    expect(getLesson('rubrics-and-criteria-lab')?.parentLessonId).toBe('rubrics-and-criteria');
  });

  it('keeps semantic-memory-lab optional and off the hub track list', () => {
    const hubIds = getHubLessonsForTrack('llm-systems').map((lesson) => lesson.id);
    expect(hubIds).not.toContain('semantic-memory-lab');
    expect(getLesson('semantic-memory-lab')?.optional).toBe(true);
    expect(getLesson('semantic-memory-lab')?.parentLessonId).toBe('semantic-memory');
  });

  it('keeps multimodal-vector-databases-lab optional and off the hub track list', () => {
    const hubIds = getHubLessonsForTrack('llm-systems').map((lesson) => lesson.id);
    expect(hubIds).not.toContain('multimodal-vector-databases-lab');
    expect(getLesson('multimodal-vector-databases-lab')?.optional).toBe(true);
    expect(getLesson('multimodal-vector-databases-lab')?.parentLessonId).toBe(
      'multimodal-vector-databases',
    );
    expect(getOptionalLabForLesson('multimodal-vector-databases')?.route).toBe(
      '/learn/labs/multimodal-vector-databases',
    );
  });

  it('orders llm reads before semantic-search-lab', () => {
    const live = getLiveLessons();
    const labIndex = live.findIndex((lesson) => lesson.id === 'semantic-search-lab');
    const readIds = live
      .slice(0, labIndex)
      .filter((lesson) => lesson.trackId === 'llm-systems' && lesson.kind === 'read')
      .map((lesson) => lesson.id);
    expect(readIds).toEqual([
      'prompts-as-instructions',
      'controlling-generation',
      'comparing-answers',
      'golden-test-cases',
      'rubrics-and-criteria',
      'structured-outputs-for-judges',
      'semantic-memory',
    ]);
  });

  it('orders retrieval labs before outside practice and harness labs', () => {
    const live = getLiveLessons();
    const evalLabIndex = live.findIndex((lesson) => lesson.id === 'first-evaluation-lab');
    const llmSlice = live
      .slice(0, evalLabIndex)
      .filter((lesson) => lesson.trackId === 'llm-systems')
      .map((lesson) => lesson.id);
    expect(llmSlice).toEqual([
      'prompts-as-instructions',
      'controlling-generation',
      'comparing-answers',
      'golden-test-cases',
      'rubrics-and-criteria',
      'structured-outputs-for-judges',
      'semantic-memory',
      'semantic-search-lab',
      'rag-playground-lab',
      'faithfulness-and-hallucinations',
      'outside-eval-practice',
    ]);
  });

  it('links new labs to routes and prerequisites', () => {
    expect(getLesson('semantic-search-lab')?.route).toBe('/learn/labs/semantic-search');
    expect(getLesson('rag-playground-lab')?.route).toBe('/learn/labs/rag-playground');
    expect(getLesson('semantic-search-lab')?.prerequisites).toEqual(['semantic-memory']);
    expect(getLesson('first-evaluation-lab')?.prerequisites).toEqual(['outside-eval-practice']);
    expect(getLesson('support-bot-decision-lab')?.prerequisites).toEqual(['first-evaluation-lab']);
    expect(getLesson('regression-evals')?.prerequisites).toEqual(['support-bot-decision-lab']);
    expect(getLesson('automation-and-judges')?.prerequisites).toEqual(['regression-evals']);
    expect(getLesson('comparing-answers')?.prerequisites).toEqual(['controlling-generation']);
  });

  it('getNextLesson skips completed lessons in global order', () => {
    const completed = new Set(['learning-from-examples', 'what-is-a-dataset', 'train-vs-test']);
    expect(getNextLesson(completed)?.id).toBe('loss-and-updates');
  });

  it('getNextLesson returns null when all live lessons complete', () => {
    const completed = new Set(getLiveLessons().map((lesson) => lesson.id));
    expect(getNextLesson(completed)).toBeNull();
  });

  it('links optional foundation labs to routes', () => {
    expect(getLesson('train-vs-test-lab')?.route).toBe('/learn/labs/train-vs-test');
    expect(getLesson('train-vs-test-lab')?.optional).toBe(true);
    expect(getLesson('loss-and-updates-lab')?.route).toBe('/learn/labs/loss-and-updates');
    expect(getLesson('loss-and-updates-lab')?.parentLessonId).toBe('loss-and-updates');
  });

  it('links neural-network-lab to labs route', () => {
    expect(getLesson('neural-network-lab')?.route).toBe('/learn/labs/neural-network');
  });

  it('orders the remaining LLM systems lessons before systems-production', () => {
    const live = getLiveLessons();
    const automationIndex = live.findIndex((lesson) => lesson.id === 'automation-and-judges');
    const afterAutomation = live.slice(automationIndex + 1).map((lesson) => lesson.id);
    expect(afterAutomation).toEqual([
      'transformers-overview',
      'tool-calling',
      'mcp',
      'multimodal-vector-databases',
      'production-concerns',
      'building-eval-harnesses',
    ]);
  });

  it('chains systems-production prerequisites from transformers-overview', () => {
    expect(getLesson('transformers-overview')?.trackId).toBe('llm-systems');
    expect(getLesson('transformers-overview')?.prerequisites).toEqual(['automation-and-judges']);
    expect(getLesson('mcp')?.prerequisites).toEqual(['tool-calling']);
    expect(getLesson('multimodal-vector-databases')?.prerequisites).toEqual(['mcp']);
    expect(getLesson('production-concerns')?.trackId).toBe('systems-production');
    expect(getLesson('production-concerns')?.prerequisites).toEqual(['transformers-overview']);
    expect(getLesson('building-eval-harnesses')?.prerequisites).toEqual(['production-concerns']);
  });

  it('places activation-functions between bias-and-weights and softmax', () => {
    expect(getLesson('bias-and-weights')?.prerequisites).toEqual(['learning-rate']);
    expect(getLesson('activation-functions')?.prerequisites).toEqual(['bias-and-weights']);
    expect(getLesson('softmax-and-distributions')?.prerequisites).toEqual(['activation-functions']);
    expect(getLesson('neural-network-lab')?.prerequisites).toEqual(['softmax-and-distributions']);
    expect(getOptionalLabForLesson('bias-and-weights')?.id).toBe('bias-and-weights-lab');
    expect(getOptionalLabForLesson('activation-functions')?.id).toBe('activation-functions-lab');
    expect(getOptionalLabForLesson('transformers-overview')?.id).toBe('transformers-lab');
  });

  it('locks read lessons until prerequisites are complete', () => {
    const lesson = getLesson('comparing-answers');
    expect(lesson).toBeTruthy();
    expect(isLessonLocked(lesson!, new Set())).toBe(true);
    expect(isLessonLocked(lesson!, new Set(['controlling-generation']))).toBe(false);
  });

  it('ignores prerequisites when unlock option is set', () => {
    const lesson = getLesson('comparing-answers');
    expect(isLessonLocked(lesson!, new Set(), { ignorePrerequisites: true })).toBe(false);
  });
});
