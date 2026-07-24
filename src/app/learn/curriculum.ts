export type LearnTrackId = 'foundation' | 'llm-systems' | 'systems-production';
export type LessonKind = 'read' | 'interactive' | 'tool';
export type LessonStatus = 'live' | 'planned';

export interface LearnTrack {
  id: LearnTrackId;
  title: string;
}

export interface LearnLessonMeta {
  id: string;
  trackId: LearnTrackId;
  order: number;
  title: string;
  summary: string;
  kind: LessonKind;
  status: LessonStatus;
  prerequisites: string[];
  route: string;
  contentFile: string | null;
  /** Optional mini-lab: reachable from a read lesson, hidden from hub track list and Continue flow. */
  optional?: boolean;
  /** Read lesson id that surfaces the optional lab link. */
  parentLessonId?: string;
  /**
   * Optional side branch (not a practice mini-lab). Hidden from Continue / hub spine;
   * surfaced as a forked spur under the spine parent on the hub.
   */
  branch?: boolean;
}

/** Nested branch lessons for a hub track spur under a spine parent. */
export interface LearnBranchSpurNode {
  lesson: LearnLessonMeta;
  children: LearnBranchSpurNode[];
}

export const LEARN_TRACKS: LearnTrack[] = [
  { id: 'foundation', title: 'Foundation' },
  { id: 'llm-systems', title: 'LLM systems' },
  { id: 'systems-production', title: 'Systems & production' },
];

export const LEARN_LESSONS: LearnLessonMeta[] = [
  {
    id: 'learning-from-examples',
    trackId: 'foundation',
    order: 1,
    title: 'Learning from examples',
    summary: 'Supervised learning: show inputs, teach targets, improve over time.',
    kind: 'read',
    status: 'live',
    prerequisites: [],
    route: '/learn/lessons/learning-from-examples',
    contentFile: 'learning-from-examples.json',
  },
  {
    id: 'learning-from-examples-lab',
    trackId: 'foundation',
    order: 1,
    title: 'Learning from examples lab',
    summary: 'Match four inputs to the targets a model should learn.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['learning-from-examples'],
    route: '/learn/labs/learning-from-examples',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'learning-from-examples',
  },
  {
    id: 'what-is-a-dataset',
    trackId: 'foundation',
    order: 2,
    title: 'What is a dataset?',
    summary: 'A dataset is labeled rows. See why XOR, AND and custom puzzles teach different things.',
    kind: 'read',
    status: 'live',
    prerequisites: ['learning-from-examples'],
    route: '/learn/lessons/what-is-a-dataset',
    contentFile: 'what-is-a-dataset.json',
  },
  {
    id: 'what-is-a-dataset-lab',
    trackId: 'foundation',
    order: 2,
    title: 'Build the XOR dataset',
    summary: 'Fill in the 0/1 target for each XOR corner yourself.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['what-is-a-dataset'],
    route: '/learn/labs/what-is-a-dataset',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'what-is-a-dataset',
  },
  {
    id: 'train-vs-test',
    trackId: 'foundation',
    order: 3,
    title: 'Train vs test',
    summary: 'Why we hold data back to check real generalization.',
    kind: 'read',
    status: 'live',
    prerequisites: ['what-is-a-dataset'],
    route: '/learn/lessons/train-vs-test',
    contentFile: 'train-vs-test.json',
  },
  {
    id: 'train-vs-test-lab',
    trackId: 'foundation',
    order: 3,
    title: 'Train vs test lab',
    summary: 'Hold out one XOR corner and compare train vs test accuracy.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['train-vs-test'],
    route: '/learn/labs/train-vs-test',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'train-vs-test',
  },
  {
    id: 'loss-and-updates',
    trackId: 'foundation',
    order: 4,
    title: 'Loss and updates',
    summary: 'Measuring wrongness and nudging weights to reduce it.',
    kind: 'read',
    status: 'live',
    prerequisites: ['train-vs-test'],
    route: '/learn/lessons/loss-and-updates',
    contentFile: 'loss-and-updates.json',
  },
  {
    id: 'loss-and-updates-lab',
    trackId: 'foundation',
    order: 4,
    title: 'Loss and updates lab',
    summary: 'Train on XOR and watch loss fall while predictions improve.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['loss-and-updates'],
    route: '/learn/labs/loss-and-updates',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'loss-and-updates',
  },
  {
    id: 'learning-rate',
    trackId: 'foundation',
    order: 5,
    title: 'Learning rate',
    summary: 'How big each weight update step is and why the step size can make or break training.',
    kind: 'read',
    status: 'live',
    prerequisites: ['loss-and-updates'],
    route: '/learn/lessons/learning-rate',
    contentFile: 'learning-rate.json',
  },
  {
    id: 'learning-rate-lab',
    trackId: 'foundation',
    order: 5,
    title: 'Learning rate lab',
    summary: 'Compare small, medium and large step sizes on the same tiny loss curve.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['learning-rate'],
    route: '/learn/labs/learning-rate',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'learning-rate',
  },
  {
    id: 'bias-and-weights',
    trackId: 'foundation',
    order: 6,
    title: 'Bias and weights',
    summary: 'How a neuron combines inputs with weights and a bias to form a decision.',
    kind: 'read',
    status: 'live',
    prerequisites: ['learning-rate'],
    route: '/learn/lessons/bias-and-weights',
    contentFile: 'bias-and-weights.json',
  },
  {
    id: 'bias-and-weights-lab',
    trackId: 'foundation',
    order: 6,
    title: 'Bias and weights lab',
    summary: 'Nudge weight and bias on a one-neuron toy to match a target boundary.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['bias-and-weights'],
    route: '/learn/labs/bias-and-weights',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'bias-and-weights',
  },
  {
    id: 'activation-functions',
    trackId: 'foundation',
    order: 7,
    title: 'Activation functions',
    summary: 'Why neurons squash scores with sigmoid, ReLU or tanh. Linear alone is not enough.',
    kind: 'read',
    status: 'live',
    prerequisites: ['bias-and-weights'],
    route: '/learn/lessons/activation-functions',
    contentFile: 'activation-functions.json',
  },
  {
    id: 'activation-functions-lab',
    trackId: 'foundation',
    order: 7,
    title: 'Activation functions lab',
    summary: 'Compare linear, sigmoid, ReLU and tanh on the same scores.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['activation-functions'],
    route: '/learn/labs/activation-functions',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'activation-functions',
  },
  {
    id: 'softmax-and-distributions',
    trackId: 'foundation',
    order: 8,
    title: 'Softmax and distributions',
    summary: 'Turn raw scores into probabilities that sum to one, including next-token style choices.',
    kind: 'read',
    status: 'live',
    prerequisites: ['activation-functions'],
    route: '/learn/lessons/softmax-and-distributions',
    contentFile: 'softmax-and-distributions.json',
  },
  {
    id: 'softmax-and-distributions-lab',
    trackId: 'foundation',
    order: 8,
    title: 'Softmax lab',
    summary: 'Adjust three raw scores and watch the probability distribution reshape.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['softmax-and-distributions'],
    route: '/learn/labs/softmax',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'softmax-and-distributions',
  },
  {
    id: 'neural-network-lab',
    trackId: 'foundation',
    order: 8,
    title: 'Neural network lab',
    summary: 'Train a tiny network on puzzles like XOR.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['softmax-and-distributions'],
    route: '/learn/labs/neural-network',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'softmax-and-distributions',
  },
  {
    id: 'embeddings-and-representations',
    trackId: 'foundation',
    order: 9,
    title: 'Embeddings and representations',
    summary: 'Hidden layers hold number patterns that capture similarity inside the model.',
    kind: 'read',
    status: 'live',
    prerequisites: ['softmax-and-distributions'],
    route: '/learn/lessons/embeddings-and-representations',
    contentFile: 'embeddings-and-representations.json',
  },
  {
    id: 'data-literacy',
    trackId: 'foundation',
    order: 10,
    title: 'Data literacy',
    summary: 'Read distributions, spot leakage and decide what labels are worth collecting.',
    kind: 'read',
    status: 'live',
    prerequisites: ['embeddings-and-representations'],
    route: '/learn/lessons/data-literacy',
    contentFile: 'data-literacy.json',
  },
  {
    id: 'decision-trees',
    trackId: 'foundation',
    order: 10,
    title: 'Decision trees',
    summary: 'Split features into readable rules and learn when trees beat black-box models.',
    kind: 'read',
    status: 'live',
    prerequisites: ['data-literacy'],
    route: '/learn/lessons/decision-trees',
    contentFile: 'decision-trees.json',
    optional: true,
    branch: true,
    parentLessonId: 'data-literacy',
  },
  {
    id: 'decision-trees-lab',
    trackId: 'foundation',
    order: 10,
    title: 'Decision trees lab',
    summary: 'Pick a root split and leaf labels on a tiny ticket-routing table.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['decision-trees'],
    route: '/learn/labs/decision-trees',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'decision-trees',
  },
  {
    id: 'deep-learning-approaches',
    trackId: 'foundation',
    order: 11,
    title: 'Deep learning approaches',
    summary: 'CNNs, RNNs and transformers as tools: pick the right inductive bias.',
    kind: 'read',
    status: 'live',
    prerequisites: ['data-literacy'],
    route: '/learn/lessons/deep-learning-approaches',
    contentFile: 'deep-learning-approaches.json',
  },
  {
    id: 'reinforcement-learning',
    trackId: 'foundation',
    order: 11,
    title: 'Reinforcement learning',
    summary: 'Agents, rewards and when trial-and-error beats labeled datasets.',
    kind: 'read',
    status: 'live',
    prerequisites: ['deep-learning-approaches'],
    route: '/learn/lessons/reinforcement-learning',
    contentFile: 'reinforcement-learning.json',
    optional: true,
    branch: true,
    parentLessonId: 'deep-learning-approaches',
  },
  {
    id: 'reinforcement-learning-lab',
    trackId: 'foundation',
    order: 11,
    title: 'Reinforcement learning lab',
    summary: 'Explore and exploit two reward arms, then lock in a policy.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['reinforcement-learning'],
    route: '/learn/labs/reinforcement-learning',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'reinforcement-learning',
  },
  {
    id: 'generative-adversarial-networks',
    trackId: 'foundation',
    order: 11,
    title: 'Generative adversarial networks',
    summary: 'Generator vs discriminator and what GANs teach about generative modeling.',
    kind: 'read',
    status: 'live',
    prerequisites: ['reinforcement-learning'],
    route: '/learn/lessons/generative-adversarial-networks',
    contentFile: 'generative-adversarial-networks.json',
    optional: true,
    branch: true,
    parentLessonId: 'reinforcement-learning-lab',
  },
  {
    id: 'tokenization-inside-models',
    trackId: 'foundation',
    order: 12,
    title: 'Tokenization inside models',
    summary: 'How text becomes tokens and embedding lookups before the network runs.',
    kind: 'read',
    status: 'live',
    prerequisites: ['deep-learning-approaches'],
    route: '/learn/lessons/tokenization-inside-models',
    contentFile: 'tokenization-inside-models.json',
  },
  {
    id: 'residual-connections',
    trackId: 'foundation',
    order: 13,
    title: 'Residual connections',
    summary: 'Skip paths and light normalization ideas that help deep stacks train.',
    kind: 'read',
    status: 'planned',
    prerequisites: ['tokenization-inside-models'],
    route: '/learn/lessons/residual-connections',
    contentFile: null,
  },
  {
    id: 'prompts-as-instructions',
    trackId: 'llm-systems',
    order: 1,
    title: 'Prompts as instructions',
    summary: 'Condition a language model with clear task wording.',
    kind: 'read',
    status: 'live',
    prerequisites: [],
    route: '/learn/lessons/prompts-as-instructions',
    contentFile: 'prompts-as-instructions.json',
  },
  {
    id: 'controlling-generation',
    trackId: 'llm-systems',
    order: 2,
    title: 'Controlling generation',
    summary: 'Temperature, top-p and max tokens: lock sampling for fair comparisons.',
    kind: 'read',
    status: 'live',
    prerequisites: ['prompts-as-instructions'],
    route: '/learn/lessons/controlling-generation',
    contentFile: 'controlling-generation.json',
  },
  {
    id: 'controlling-generation-lab',
    trackId: 'llm-systems',
    order: 2,
    title: 'Generation variance lab',
    summary: 'See how temperature changes answer variety on the same prompt.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['controlling-generation'],
    route: '/learn/labs/controlling-generation',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'controlling-generation',
  },
  {
    id: 'comparing-answers',
    trackId: 'llm-systems',
    order: 3,
    title: 'Comparing answers',
    summary: 'Same prompt, multiple models: judge which response is stronger.',
    kind: 'read',
    status: 'live',
    prerequisites: ['controlling-generation'],
    route: '/learn/lessons/comparing-answers',
    contentFile: 'comparing-answers.json',
  },
  {
    id: 'comparing-answers-lab',
    trackId: 'llm-systems',
    order: 3,
    title: 'Comparing answers lab',
    summary: 'Pick the stronger of two answers per criterion; compare to reference verdicts.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['comparing-answers'],
    route: '/learn/labs/comparing-answers',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'comparing-answers',
  },
  {
    id: 'golden-test-cases',
    trackId: 'llm-systems',
    order: 4,
    title: 'Golden test cases',
    summary: 'Reusable prompts and failure modes beat one-off ad-hoc checks.',
    kind: 'read',
    status: 'live',
    prerequisites: ['comparing-answers'],
    route: '/learn/lessons/golden-test-cases',
    contentFile: 'golden-test-cases.json',
  },
  {
    id: 'rubrics-and-criteria',
    trackId: 'llm-systems',
    order: 5,
    title: 'Rubrics and criteria',
    summary: 'Break quality into scorable rows with clear anchors.',
    kind: 'read',
    status: 'live',
    prerequisites: ['golden-test-cases'],
    route: '/learn/lessons/rubrics-and-criteria',
    contentFile: 'rubrics-and-criteria.json',
  },
  {
    id: 'rubrics-and-criteria-lab',
    trackId: 'llm-systems',
    order: 5,
    title: 'Rubrics and criteria lab',
    summary: 'Score one answer on an anchored 1-5 rubric; compare to reference scores.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['rubrics-and-criteria'],
    route: '/learn/labs/rubrics-and-criteria',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'rubrics-and-criteria',
  },
  {
    id: 'structured-outputs-for-judges',
    trackId: 'llm-systems',
    order: 6,
    title: 'Structured outputs for judges',
    summary: 'Judge models must return parseable JSON scores per criterion.',
    kind: 'read',
    status: 'live',
    prerequisites: ['rubrics-and-criteria'],
    route: '/learn/lessons/structured-outputs-for-judges',
    contentFile: 'structured-outputs-for-judges.json',
  },
  {
    id: 'judge-json-lab',
    trackId: 'llm-systems',
    order: 6,
    title: 'Judge JSON lab',
    summary: 'Spot valid judge JSON and common parse failures.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['structured-outputs-for-judges'],
    route: '/learn/labs/judge-json',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'structured-outputs-for-judges',
  },
  {
    id: 'semantic-memory',
    trackId: 'llm-systems',
    order: 7,
    title: 'Semantic memory',
    summary: 'Store knowledge outside the model and fetch the right passages by meaning.',
    kind: 'read',
    status: 'live',
    prerequisites: ['structured-outputs-for-judges'],
    route: '/learn/lessons/semantic-memory',
    contentFile: 'semantic-memory.json',
  },
  {
    id: 'semantic-memory-lab',
    trackId: 'llm-systems',
    order: 7,
    title: 'Semantic memory practice',
    summary: 'Rank three teaching chunks by meaning with a fixed query.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['semantic-memory'],
    route: '/learn/labs/semantic-memory',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'semantic-memory',
  },
  {
    id: 'semantic-search-lab',
    trackId: 'llm-systems',
    order: 7,
    title: 'Semantic search lab',
    summary: 'See how embeddings rank text chunks by meaning.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['semantic-memory'],
    route: '/learn/labs/semantic-search',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'semantic-memory',
  },
  {
    id: 'rag-playground-lab',
    trackId: 'llm-systems',
    order: 7,
    title: 'RAG playground',
    summary: 'Retrieve chunks, assemble context and preview a stub answer.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['semantic-search-lab'],
    route: '/learn/labs/rag-playground',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'semantic-search-lab',
  },
  {
    id: 'faithfulness-and-hallucinations',
    trackId: 'llm-systems',
    order: 8,
    title: 'Faithfulness and hallucinations',
    summary: 'Ground answers in retrieved context; spot invented facts.',
    kind: 'read',
    status: 'live',
    prerequisites: ['semantic-memory'],
    route: '/learn/lessons/faithfulness-and-hallucinations',
    contentFile: 'faithfulness-and-hallucinations.json',
  },
  {
    id: 'faithfulness-lab',
    trackId: 'llm-systems',
    order: 8,
    title: 'Faithfulness lab',
    summary: 'Mark which answer sentences are supported by the provided context.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['faithfulness-and-hallucinations'],
    route: '/learn/labs/faithfulness',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'faithfulness-and-hallucinations',
  },
  {
    id: 'outside-eval-practice',
    trackId: 'llm-systems',
    order: 9,
    title: 'Outside eval practice',
    summary: 'Build a golden set and rubric for an Acme support bot, then judge canned answers with evidence.',
    kind: 'read',
    status: 'live',
    prerequisites: ['faithfulness-and-hallucinations'],
    route: '/learn/lessons/outside-eval-practice',
    contentFile: 'outside-eval-practice.json',
  },
  {
    id: 'first-evaluation-lab',
    trackId: 'llm-systems',
    order: 9,
    title: 'First evaluation lab',
    summary: 'Warm up the AiEval harness with a seeded Acme support prompt.',
    kind: 'tool',
    status: 'live',
    prerequisites: ['outside-eval-practice'],
    route: '/learn/labs/first-evaluation',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'outside-eval-practice',
  },
  {
    id: 'support-bot-decision-lab',
    trackId: 'llm-systems',
    order: 9,
    title: 'Support bot decision lab',
    summary: 'Run a full AiEval comparison and make a ship, ship-other or neither call with evidence.',
    kind: 'tool',
    status: 'live',
    prerequisites: ['first-evaluation-lab'],
    route: '/learn/labs/support-bot-decision',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'first-evaluation-lab',
  },
  {
    id: 'regression-evals',
    trackId: 'llm-systems',
    order: 10,
    title: 'Regression evals',
    summary: 'Re-run a golden set after changes to catch quality drops.',
    kind: 'read',
    status: 'live',
    prerequisites: ['outside-eval-practice'],
    route: '/learn/lessons/regression-evals',
    contentFile: 'regression-evals.json',
  },
  {
    id: 'automation-and-judges',
    trackId: 'llm-systems',
    order: 11,
    title: 'Automation and judges',
    summary: 'When AI scores answers for you and when to double-check.',
    kind: 'read',
    status: 'live',
    prerequisites: ['regression-evals'],
    route: '/learn/lessons/automation-and-judges',
    contentFile: 'automation-and-judges.json',
  },
  {
    id: 'transformers-overview',
    trackId: 'llm-systems',
    order: 12,
    title: 'Transformers',
    summary: 'Attention, tokens and next-token prediction.',
    kind: 'read',
    status: 'live',
    prerequisites: ['automation-and-judges'],
    route: '/learn/lessons/transformers-overview',
    contentFile: 'transformers-overview.json',
  },
  {
    id: 'transformers-lab',
    trackId: 'llm-systems',
    order: 12,
    title: 'Transformers lab',
    summary: 'Tune a tiny attention pattern and watch next-token preference shift.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['transformers-overview'],
    route: '/learn/labs/transformers',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'transformers-overview',
  },
  {
    id: 'tool-calling',
    trackId: 'llm-systems',
    order: 13,
    title: 'Tool calling',
    summary: 'Let models request structured tool calls and eval when those tools fail.',
    kind: 'read',
    status: 'live',
    prerequisites: ['transformers-overview'],
    route: '/learn/lessons/tool-calling',
    contentFile: 'tool-calling.json',
  },
  {
    id: 'mcp',
    trackId: 'llm-systems',
    order: 14,
    title: 'MCP',
    summary: 'Model Context Protocol: standard connectors for tools and context.',
    kind: 'read',
    status: 'live',
    prerequisites: ['tool-calling'],
    route: '/learn/lessons/mcp',
    contentFile: 'mcp.json',
  },
  {
    id: 'multimodal-vector-databases',
    trackId: 'llm-systems',
    order: 15,
    title: 'Multimodal vector databases',
    summary: 'Store and retrieve text, image and mixed embeddings for RAG at scale.',
    kind: 'read',
    status: 'live',
    prerequisites: ['mcp'],
    route: '/learn/lessons/multimodal-vector-databases',
    contentFile: 'multimodal-vector-databases.json',
  },
  {
    id: 'multimodal-vector-databases-lab',
    trackId: 'llm-systems',
    order: 15,
    title: 'Multimodal vector databases lab',
    summary: 'Rank image and text product matches with metadata filters.',
    kind: 'interactive',
    status: 'live',
    prerequisites: ['multimodal-vector-databases'],
    route: '/learn/labs/multimodal-vector-databases',
    contentFile: null,
    optional: true,
    branch: true,
    parentLessonId: 'multimodal-vector-databases',
  },
  {
    id: 'production-concerns',
    trackId: 'systems-production',
    order: 1,
    title: 'Production concerns',
    summary: 'Cost, latency, monitoring and safety at scale.',
    kind: 'read',
    status: 'live',
    prerequisites: [],
    route: '/learn/lessons/production-concerns',
    contentFile: 'production-concerns.json',
  },
  {
    id: 'building-eval-harnesses',
    trackId: 'systems-production',
    order: 2,
    title: 'Building eval harnesses',
    summary: 'How tools like AiEval wire generate, score and improve.',
    kind: 'read',
    status: 'live',
    prerequisites: ['production-concerns'],
    route: '/learn/lessons/building-eval-harnesses',
    contentFile: 'building-eval-harnesses.json',
  },
  {
    id: 'scalable-ai-systems',
    trackId: 'systems-production',
    order: 3,
    title: 'Strategies for scalable AI systems',
    summary: 'Capacity, caching, fallbacks and eval gates when traffic grows.',
    kind: 'read',
    status: 'planned',
    prerequisites: ['building-eval-harnesses'],
    route: '/learn/lessons/scalable-ai-systems',
    contentFile: null,
  },
];

const TRACK_ORDER: LearnTrackId[] = ['foundation', 'llm-systems', 'systems-production'];

const LIVE_LESSON_ORDER = LEARN_LESSONS.filter(
  (lesson) => lesson.status === 'live' && !lesson.optional,
).sort((a, b) => {
  const trackDiff = TRACK_ORDER.indexOf(a.trackId) - TRACK_ORDER.indexOf(b.trackId);
  if (trackDiff !== 0) {
    return trackDiff;
  }
  return a.order - b.order;
});

export function getTrack(trackId: LearnTrackId): LearnTrack | undefined {
  return LEARN_TRACKS.find((track) => track.id === trackId);
}

export function getLesson(id: string): LearnLessonMeta | undefined {
  return LEARN_LESSONS.find((lesson) => lesson.id === id);
}

export function getLessonsForTrack(trackId: LearnTrackId): LearnLessonMeta[] {
  return LEARN_LESSONS.filter((lesson) => lesson.trackId === trackId)
    .map((lesson, index) => ({ lesson, index }))
    .sort((a, b) => a.lesson.order - b.lesson.order || a.index - b.index)
    .map(({ lesson }) => lesson);
}

export function getHubLessonsForTrack(trackId: LearnTrackId): LearnLessonMeta[] {
  return getLessonsForTrack(trackId).filter((lesson) => !lesson.optional);
}

export function getOptionalLabForLesson(lessonId: string): LearnLessonMeta | undefined {
  return LEARN_LESSONS.find(
    (lesson) => lesson.optional && !lesson.branch && lesson.parentLessonId === lessonId,
  );
}

function branchChildrenOf(parentId: string): LearnLessonMeta[] {
  return LEARN_LESSONS.filter((lesson) => lesson.branch && lesson.parentLessonId === parentId)
    .map((lesson, index) => ({ lesson, index }))
    .sort((a, b) => a.lesson.order - b.lesson.order || a.index - b.index)
    .map(({ lesson }) => lesson);
}

function toBranchSpurNode(lesson: LearnLessonMeta): LearnBranchSpurNode {
  return {
    lesson,
    children: branchChildrenOf(lesson.id).map(toBranchSpurNode),
  };
}

/** Branch spur tree rooted under a spine (or other) parent lesson id. */
export function getBranchSpurForLesson(parentId: string): LearnBranchSpurNode[] {
  return branchChildrenOf(parentId).map(toBranchSpurNode);
}

export function getLiveLessons(): LearnLessonMeta[] {
  return [...LIVE_LESSON_ORDER];
}

export function getKnownLessonIds(): Set<string> {
  return new Set(LEARN_LESSONS.map((lesson) => lesson.id));
}

export function prerequisitesMet(lesson: LearnLessonMeta, completedIds: Set<string>): boolean {
  return lesson.prerequisites.every((id) => completedIds.has(id));
}

export function isLessonLocked(
  lesson: LearnLessonMeta,
  completedIds: Set<string>,
  options?: { ignorePrerequisites?: boolean },
): boolean {
  if (options?.ignorePrerequisites) {
    return false;
  }
  return !prerequisitesMet(lesson, completedIds);
}

export function getNextLesson(completedIds: Set<string>): LearnLessonMeta | null {
  for (const lesson of LIVE_LESSON_ORDER) {
    if (!completedIds.has(lesson.id)) {
      return lesson;
    }
  }
  return null;
}

export function getAdjacentLessons(lessonId: string): {
  previous: LearnLessonMeta | null;
  next: LearnLessonMeta | null;
} {
  const index = LIVE_LESSON_ORDER.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) {
    return { previous: null, next: null };
  }
  return {
    previous: index > 0 ? LIVE_LESSON_ORDER[index - 1]! : null,
    next: index < LIVE_LESSON_ORDER.length - 1 ? LIVE_LESSON_ORDER[index + 1]! : null,
  };
}

/**
 * Spine lesson used for Continue-order prev/next when `lesson` is optional/branch.
 * Walks `parentLessonId` until a non-optional lesson (or null).
 */
export function getSpineNavigationAnchor(lesson: LearnLessonMeta): LearnLessonMeta | null {
  if (!lesson.optional) {
    return lesson;
  }

  const seen = new Set<string>();
  let current: LearnLessonMeta | undefined = lesson;
  while (current?.optional && current.parentLessonId) {
    if (seen.has(current.id)) {
      return null;
    }
    seen.add(current.id);
    current = getLesson(current.parentLessonId);
  }
  return current && !current.optional ? current : null;
}

/** Prev/next for hub Continue order, resolving optional/branch lessons via spine parent. */
export function getNavigableAdjacent(lessonId: string): {
  previous: LearnLessonMeta | null;
  next: LearnLessonMeta | null;
} {
  const lesson = getLesson(lessonId);
  if (!lesson) {
    return { previous: null, next: null };
  }
  const anchor = getSpineNavigationAnchor(lesson);
  if (!anchor) {
    return { previous: null, next: null };
  }
  return getAdjacentLessons(anchor.id);
}

export interface CurriculumValidationIssue {
  lessonId: string;
  message: string;
}

export function validateCurriculum(contentLessonIds: Set<string>): CurriculumValidationIssue[] {
  const issues: CurriculumValidationIssue[] = [];
  const ids = new Set<string>();

  for (const lesson of LEARN_LESSONS) {
    if (ids.has(lesson.id)) {
      issues.push({ lessonId: lesson.id, message: 'Duplicate lesson id' });
    }
    ids.add(lesson.id);

    for (const prerequisite of lesson.prerequisites) {
      if (!getLesson(prerequisite)) {
        issues.push({
          lessonId: lesson.id,
          message: `Unknown prerequisite: ${prerequisite}`,
        });
      }
    }

    if (lesson.status === 'live' && lesson.kind === 'read' && !lesson.contentFile) {
      issues.push({ lessonId: lesson.id, message: 'Live read lesson missing contentFile' });
    }

    if (lesson.contentFile && !contentLessonIds.has(lesson.id)) {
      issues.push({
        lessonId: lesson.id,
        message: `Missing content loader for ${lesson.contentFile}`,
      });
    }

    if (lesson.status === 'live' && !lesson.route) {
      issues.push({ lessonId: lesson.id, message: 'Live lesson missing route' });
    }
  }

  for (const trackId of TRACK_ORDER) {
    const trackLessons = getHubLessonsForTrack(trackId);
    const orders = trackLessons.map((lesson) => lesson.order);
    const expected = trackLessons.map((_, index) => index + 1);
    if (orders.join(',') !== expected.join(',')) {
      issues.push({
        lessonId: trackId,
        message: `Track ${trackId} has non-contiguous order values`,
      });
    }
  }

  const arrayIndex = new Map(LEARN_LESSONS.map((lesson, index) => [lesson.id, index]));
  for (const lesson of LEARN_LESSONS) {
    for (const prerequisiteId of lesson.prerequisites) {
      const prerequisite = getLesson(prerequisiteId);
      if (!prerequisite) {
        continue;
      }
      if (prerequisite.trackId !== lesson.trackId) {
        continue;
      }
      if (prerequisite.order > lesson.order) {
        issues.push({
          lessonId: lesson.id,
          message: `Prerequisite ${prerequisiteId} has higher order (${prerequisite.order}) than this lesson (${lesson.order})`,
        });
        continue;
      }
      if (
        prerequisite.order === lesson.order &&
        (arrayIndex.get(prerequisiteId) ?? 0) > (arrayIndex.get(lesson.id) ?? 0)
      ) {
        issues.push({
          lessonId: lesson.id,
          message: `Prerequisite ${prerequisiteId} appears after this lesson in LEARN_LESSONS at equal order ${lesson.order}`,
        });
      }
    }
  }

  return issues;
}
