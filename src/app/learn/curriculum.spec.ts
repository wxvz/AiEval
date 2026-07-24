import { describe, expect, it } from 'vitest';

import {
  getLiveLessons,
  getNextLesson,
  getLesson,
  getHubLessonsForTrack,
  getBranchSpurForLesson,
  getNavigableAdjacent,
  getOptionalLabForLesson,
  getSpineNavigationAnchor,
  isLessonLocked,
  validateCurriculum,
  LEARN_LESSONS,
} from './curriculum';
import { getContentLessonIds } from './learn-content';

describe('curriculum', () => {
  it('passes validateCurriculum', () => {
    const issues = validateCurriculum(getContentLessonIds());
    expect(issues).toEqual([]);
  });

  it('orders live foundation reads through softmax before embeddings', () => {
    const live = getLiveLessons();
    const embedIndex = live.findIndex((lesson) => lesson.id === 'embeddings-and-representations');
    const readIds = live
      .slice(0, embedIndex)
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
    expect(live.map((lesson) => lesson.id)).not.toContain('neural-network-lab');
  });

  it('keeps the neural spine after softmax without trees/RL/GANs or the NN lab', () => {
    const foundationIds = getLiveLessons()
      .filter((lesson) => lesson.trackId === 'foundation')
      .map((lesson) => lesson.id);
    const softmaxIndex = foundationIds.indexOf('softmax-and-distributions');
    expect(foundationIds.slice(softmaxIndex)).toEqual([
      'softmax-and-distributions',
      'embeddings-and-representations',
      'data-literacy',
      'deep-learning-approaches',
      'tokenization-inside-models',
    ]);
    expect(getLesson('deep-learning-approaches')?.prerequisites).toEqual(['data-literacy']);
    expect(getLesson('prompts-as-instructions')?.prerequisites).toEqual([]);
    expect(getLesson('embeddings-and-representations')?.prerequisites).toEqual(['softmax-and-distributions']);
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
      'embeddings-and-representations',
      'data-literacy',
      'deep-learning-approaches',
      'tokenization-inside-models',
      'residual-connections',
    ]);
    expect(hubIds).not.toContain('neural-network-lab');
    expect(hubIds).not.toContain('decision-trees');
    expect(hubIds).not.toContain('reinforcement-learning');
    expect(hubIds).not.toContain('generative-adversarial-networks');
    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('train-vs-test-lab');
    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('decision-trees');
    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('reinforcement-learning-lab');
  });

  it('demotes trees, RL and GANs to optional side branches', () => {
    expect(getLesson('decision-trees')?.optional).toBe(true);
    expect(getLesson('decision-trees')?.branch).toBe(true);
    expect(getLesson('decision-trees')?.parentLessonId).toBe('data-literacy');
    expect(getLesson('decision-trees-lab')?.optional).toBe(true);
    expect(getLesson('decision-trees-lab')?.branch).toBe(true);
    expect(getLesson('reinforcement-learning')?.optional).toBe(true);
    expect(getLesson('reinforcement-learning')?.branch).toBe(true);
    expect(getLesson('reinforcement-learning')?.parentLessonId).toBe('deep-learning-approaches');
    expect(getLesson('reinforcement-learning-lab')?.optional).toBe(true);
    expect(getLesson('reinforcement-learning-lab')?.branch).toBe(true);
    expect(getLesson('generative-adversarial-networks')?.optional).toBe(true);
    expect(getLesson('generative-adversarial-networks')?.branch).toBe(true);
    expect(getLesson('generative-adversarial-networks')?.parentLessonId).toBe(
      'reinforcement-learning-lab',
    );
  });

  it('surfaces practice and spine labs as hub branch spurs, not aside optional labs', () => {
    expect(getOptionalLabForLesson('train-vs-test')).toBeUndefined();
    expect(getOptionalLabForLesson('softmax-and-distributions')).toBeUndefined();
    expect(getOptionalLabForLesson('semantic-memory')).toBeUndefined();
    expect(getOptionalLabForLesson('data-literacy')).toBeUndefined();

    const softmaxSpur = getBranchSpurForLesson('softmax-and-distributions');
    expect(softmaxSpur.map((n) => n.lesson.id)).toEqual([
      'softmax-and-distributions-lab',
      'neural-network-lab',
    ]);

    const memorySpur = getBranchSpurForLesson('semantic-memory');
    expect(memorySpur.map((n) => n.lesson.id)).toEqual([
      'semantic-memory-lab',
      'semantic-search-lab',
    ]);
    expect(memorySpur.find((n) => n.lesson.id === 'semantic-search-lab')?.children[0]?.lesson.id).toBe(
      'rag-playground-lab',
    );

    const outsideSpur = getBranchSpurForLesson('outside-eval-practice');
    expect(outsideSpur).toHaveLength(1);
    expect(outsideSpur[0]?.lesson.id).toBe('first-evaluation-lab');
    expect(outsideSpur[0]?.children[0]?.lesson.id).toBe('support-bot-decision-lab');
  });

  it('resolves Continue neighbors for nested branch labs via spine parent', () => {
    expect(getSpineNavigationAnchor(getLesson('rag-playground-lab')!)?.id).toBe('semantic-memory');
    expect(getNavigableAdjacent('rag-playground-lab').previous?.id).toBe(
      'structured-outputs-for-judges',
    );
    expect(getNavigableAdjacent('rag-playground-lab').next?.id).toBe(
      'faithfulness-and-hallucinations',
    );
    expect(getNavigableAdjacent('decision-trees').previous?.id).toBe('embeddings-and-representations');
    expect(getNavigableAdjacent('decision-trees').next?.id).toBe('deep-learning-approaches');
    expect(getNavigableAdjacent('softmax-and-distributions').next?.id).toBe(
      'embeddings-and-representations',
    );
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
    expect(llmIds).not.toContain('semantic-search-lab');
    expect(llmIds).not.toContain('rag-playground-lab');
    expect(llmIds).not.toContain('first-evaluation-lab');
    expect(getLesson('comparing-answers-lab')?.optional).toBe(true);
    expect(getLesson('comparing-answers-lab')?.branch).toBe(true);
    expect(getLesson('rubrics-and-criteria-lab')?.parentLessonId).toBe('rubrics-and-criteria');
  });

  it('keeps semantic-memory-lab optional and off the hub track list', () => {
    const hubIds = getHubLessonsForTrack('llm-systems').map((lesson) => lesson.id);
    expect(hubIds).not.toContain('semantic-memory-lab');
    expect(getLesson('semantic-memory-lab')?.optional).toBe(true);
    expect(getLesson('semantic-memory-lab')?.branch).toBe(true);
    expect(getLesson('semantic-memory-lab')?.parentLessonId).toBe('semantic-memory');
  });

  it('keeps multimodal-vector-databases-lab optional and off the hub track list', () => {
    const hubIds = getHubLessonsForTrack('llm-systems').map((lesson) => lesson.id);
    expect(hubIds).not.toContain('multimodal-vector-databases-lab');
    expect(getLesson('multimodal-vector-databases-lab')?.optional).toBe(true);
    expect(getLesson('multimodal-vector-databases-lab')?.parentLessonId).toBe(
      'multimodal-vector-databases',
    );
    expect(getOptionalLabForLesson('multimodal-vector-databases')).toBeUndefined();
    expect(getBranchSpurForLesson('multimodal-vector-databases')[0]?.lesson.id).toBe(
      'multimodal-vector-databases-lab',
    );
  });

  it('orders llm reads through semantic-memory before faithfulness', () => {
    const live = getLiveLessons();
    const faithIndex = live.findIndex((lesson) => lesson.id === 'faithfulness-and-hallucinations');
    const readIds = live
      .slice(0, faithIndex)
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

  it('orders llm spine through outside practice without retrieval or harness labs', () => {
    const live = getLiveLessons();
    const regressionIndex = live.findIndex((lesson) => lesson.id === 'regression-evals');
    const llmSlice = live
      .slice(0, regressionIndex + 1)
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
      'faithfulness-and-hallucinations',
      'outside-eval-practice',
      'regression-evals',
    ]);
  });

  it('links new labs to routes and rewired Continue prerequisites', () => {
    expect(getLesson('semantic-search-lab')?.route).toBe('/learn/labs/semantic-search');
    expect(getLesson('rag-playground-lab')?.route).toBe('/learn/labs/rag-playground');
    expect(getLesson('semantic-search-lab')?.optional).toBe(true);
    expect(getLesson('semantic-search-lab')?.branch).toBe(true);
    expect(getLesson('rag-playground-lab')?.parentLessonId).toBe('semantic-search-lab');
    expect(getLesson('semantic-search-lab')?.prerequisites).toEqual(['semantic-memory']);
    expect(getLesson('first-evaluation-lab')?.prerequisites).toEqual(['outside-eval-practice']);
    expect(getLesson('support-bot-decision-lab')?.prerequisites).toEqual(['first-evaluation-lab']);
    expect(getLesson('faithfulness-and-hallucinations')?.prerequisites).toEqual(['semantic-memory']);
    expect(getLesson('regression-evals')?.prerequisites).toEqual(['outside-eval-practice']);
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
    expect(getLesson('train-vs-test-lab')?.branch).toBe(true);
    expect(getLesson('loss-and-updates-lab')?.route).toBe('/learn/labs/loss-and-updates');
    expect(getLesson('loss-and-updates-lab')?.parentLessonId).toBe('loss-and-updates');
  });

  it('links neural-network-lab to labs route as a branch', () => {
    expect(getLesson('neural-network-lab')?.route).toBe('/learn/labs/neural-network');
    expect(getLesson('neural-network-lab')?.optional).toBe(true);
    expect(getLesson('neural-network-lab')?.branch).toBe(true);
    expect(getLesson('neural-network-lab')?.parentLessonId).toBe('softmax-and-distributions');
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

  it('lets each track start without prior-track prerequisites', () => {
    expect(getLesson('learning-from-examples')?.prerequisites).toEqual([]);
    expect(getLesson('prompts-as-instructions')?.prerequisites).toEqual([]);
    expect(getLesson('production-concerns')?.prerequisites).toEqual([]);
    expect(isLessonLocked(getLesson('prompts-as-instructions')!, new Set())).toBe(false);
    expect(isLessonLocked(getLesson('production-concerns')!, new Set())).toBe(false);
  });

  it('chains systems-production prerequisites from production-concerns', () => {
    expect(getLesson('transformers-overview')?.trackId).toBe('llm-systems');
    expect(getLesson('transformers-overview')?.prerequisites).toEqual(['automation-and-judges']);
    expect(getLesson('mcp')?.prerequisites).toEqual(['tool-calling']);
    expect(getLesson('multimodal-vector-databases')?.prerequisites).toEqual(['mcp']);
    expect(getLesson('production-concerns')?.trackId).toBe('systems-production');
    expect(getLesson('production-concerns')?.prerequisites).toEqual([]);
    expect(getLesson('building-eval-harnesses')?.prerequisites).toEqual(['production-concerns']);
  });

  it('lists screenshot eval-gap lessons as planned stubs on the hub', () => {
    const llmHub = getHubLessonsForTrack('llm-systems').map((lesson) => lesson.id);
    expect(llmHub).toEqual([
      'why-evaluation-matters',
      'prompts-as-instructions',
      'controlling-generation',
      'comparing-answers',
      'golden-test-cases',
      'metrics-101',
      'rubrics-and-criteria',
      'structured-outputs-for-judges',
      'semantic-memory',
      'faithfulness-and-hallucinations',
      'outside-eval-practice',
      'error-analysis',
      'regression-evals',
      'statistical-significance',
      'automation-and-judges',
      'human-evaluation',
      'eval-reports',
      'evaluation-anti-patterns',
      'transformers-overview',
      'tool-calling',
      'guardrails-and-safety',
      'multi-turn-evaluation',
      'mcp',
      'multimodal-vector-databases',
    ]);

    const prodHub = getHubLessonsForTrack('systems-production').map((lesson) => lesson.id);
    expect(prodHub).toEqual([
      'production-concerns',
      'building-eval-harnesses',
      'data-quality-monitoring',
      'monitoring-and-alerts',
      'canary-and-rollout-evals',
      'slos-for-ai-systems',
      'scalable-ai-systems',
    ]);

    const plannedStubIds = [
      'why-evaluation-matters',
      'metrics-101',
      'error-analysis',
      'statistical-significance',
      'human-evaluation',
      'eval-reports',
      'evaluation-anti-patterns',
      'guardrails-and-safety',
      'multi-turn-evaluation',
      'data-quality-monitoring',
      'monitoring-and-alerts',
      'canary-and-rollout-evals',
      'slos-for-ai-systems',
    ];
    for (const id of plannedStubIds) {
      const lesson = getLesson(id);
      expect(lesson?.status).toBe('planned');
      expect(lesson?.contentFile).toBeNull();
      expect(lesson?.kind).toBe('read');
    }

    const plannedIds = new Set(
      LEARN_LESSONS.filter((lesson) => lesson.status === 'planned').map((lesson) => lesson.id),
    );
    for (const lesson of LEARN_LESSONS) {
      if (lesson.status !== 'live') {
        continue;
      }
      for (const prerequisiteId of lesson.prerequisites) {
        expect(plannedIds.has(prerequisiteId)).toBe(false);
      }
    }

    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('why-evaluation-matters');
    expect(getLiveLessons().map((lesson) => lesson.id)).not.toContain('monitoring-and-alerts');
  });

  it('places activation-functions between bias-and-weights and softmax', () => {
    expect(getLesson('bias-and-weights')?.prerequisites).toEqual(['learning-rate']);
    expect(getLesson('activation-functions')?.prerequisites).toEqual(['bias-and-weights']);
    expect(getLesson('softmax-and-distributions')?.prerequisites).toEqual(['activation-functions']);
    expect(getLesson('neural-network-lab')?.prerequisites).toEqual(['softmax-and-distributions']);
    expect(getBranchSpurForLesson('bias-and-weights')[0]?.lesson.id).toBe('bias-and-weights-lab');
    expect(getBranchSpurForLesson('activation-functions')[0]?.lesson.id).toBe(
      'activation-functions-lab',
    );
    expect(getBranchSpurForLesson('transformers-overview')[0]?.lesson.id).toBe('transformers-lab');
  });

  it('locks read lessons until prerequisites are complete', () => {
    const lesson = getLesson('comparing-answers');
    expect(lesson).toBeTruthy();
    expect(isLessonLocked(lesson!, new Set())).toBe(true);
    expect(isLessonLocked(lesson!, new Set(['controlling-generation']))).toBe(false);
  });

  it('locks labs until prerequisites are complete', () => {
    const lab = getLesson('neural-network-lab');
    expect(lab).toBeTruthy();
    expect(isLessonLocked(lab!, new Set())).toBe(true);
    expect(isLessonLocked(lab!, new Set(['softmax-and-distributions']))).toBe(false);
  });

  it('ignores prerequisites when unlock option is set', () => {
    const lesson = getLesson('comparing-answers');
    expect(isLessonLocked(lesson!, new Set(), { ignorePrerequisites: true })).toBe(false);
    const lab = getLesson('semantic-search-lab');
    expect(isLessonLocked(lab!, new Set(), { ignorePrerequisites: true })).toBe(false);
  });

  it('keeps optional lesson order at or after parent prerequisites', () => {
    expect(getLesson('train-vs-test-lab')?.order).toBe(getLesson('train-vs-test')?.order);
    expect(getLesson('decision-trees')?.order).toBe(getLesson('data-literacy')?.order);
    expect(getLesson('reinforcement-learning')?.order).toBe(
      getLesson('deep-learning-approaches')?.order,
    );
    const foundation = LEARN_LESSONS.filter((lesson) => lesson.trackId === 'foundation');
    const sorted = [...foundation].sort((a, b) => a.order - b.order);
    const index = new Map(sorted.map((lesson, i) => [lesson.id, i]));
    for (const lesson of foundation) {
      for (const prerequisiteId of lesson.prerequisites) {
        const preIdx = index.get(prerequisiteId);
        const lessonIdx = index.get(lesson.id);
        if (preIdx !== undefined && lessonIdx !== undefined) {
          expect(preIdx).toBeLessThan(lessonIdx);
        }
      }
    }
  });
});
