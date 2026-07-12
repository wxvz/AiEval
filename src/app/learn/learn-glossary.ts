export type LearnGlossaryTerm =
  | 'supervisedLearning'
  | 'input'
  | 'target'
  | 'prediction'
  | 'model'
  | 'labeledData'
  | 'trainSet'
  | 'testSet'
  | 'validationSet'
  | 'generalization'
  | 'weights'
  | 'memorization'
  | 'classifier'
  | 'hyperparameters'
  | 'loss'
  | 'learningRate'
  | 'epoch'
  | 'gradient'
  | 'semanticMemory'
  | 'contextWindow'
  | 'embedding'
  | 'retrieval'
  | 'chunk'
  | 'prompt'
  | 'largeLanguageModel'
  | 'token'
  | 'attention'
  | 'rubric'
  | 'criterion'
  | 'judge'
  | 'evaluation'
  | 'temperature'
  | 'topP'
  | 'maxTokens'
  | 'testCase'
  | 'goldenSet'
  | 'structuredOutput'
  | 'faithfulness'
  | 'hallucination'
  | 'regressionEval';

export interface LearnGlossaryEntry {
  label: string;
  explanation: string;
}

export const LEARN_GLOSSARY: Record<LearnGlossaryTerm, LearnGlossaryEntry> = {
  supervisedLearning: {
    label: 'supervised learning',
    explanation:
      'Learning from examples where each input has a known correct answer (target). The model studies many pairs and learns to predict targets for new inputs.',
  },
  input: {
    label: 'input',
    explanation:
      'What you show the model — a photo, a paragraph, two numbers, or a user prompt. The model tries to produce an output from this alone.',
  },
  target: {
    label: 'target',
    explanation:
      'The correct answer you want the model to learn for an input — a label, score, category, or expected response. Also called the label.',
  },
  prediction: {
    label: 'prediction',
    explanation:
      'What the model outputs right now, before or after training. Training tries to move predictions closer to targets.',
  },
  model: {
    label: 'model',
    explanation:
      'The learned program that maps inputs to predictions. In this course it might be a small neural network or a large language model.',
  },
  labeledData: {
    label: 'labeled data',
    explanation:
      'Examples where humans (or trusted rules) have already marked the right answer. Without labels you cannot train a supervised model.',
  },
  trainSet: {
    label: 'train set',
    explanation:
      'Examples the model is allowed to learn from — weights are updated using these rows during training.',
  },
  testSet: {
    label: 'test set',
    explanation:
      'Examples held back during training and used only to measure performance. Simulates how the model might do on new, unseen data.',
  },
  validationSet: {
    label: 'validation set',
    explanation:
      'A third split used while developing the model (tuning settings). Keeps the test set untouched for a final honest score.',
  },
  generalization: {
    label: 'generalization',
    explanation:
      'How well the model performs on new inputs it was not trained on — not just on memorized training rows.',
  },
  weights: {
    label: 'weights',
    explanation:
      'Internal numbers the model adjusts during training. Better weights usually mean predictions closer to targets.',
  },
  memorization: {
    label: 'memorization',
    explanation:
      'When a model remembers training answers instead of learning a rule. It can score perfectly on training data but fail on new examples.',
  },
  classifier: {
    label: 'classifier',
    explanation:
      'A model that picks a category for an input — for example spam vs not spam, or dog vs cat.',
  },
  hyperparameters: {
    label: 'hyperparameters',
    explanation:
      'Settings you choose before training (learning rate, layer size, prompt wording). Not learned from data — you tune them by experiment.',
  },
  loss: {
    label: 'loss',
    explanation:
      'A number that measures how wrong the model’s predictions are. Training tries to push loss down so predictions match targets.',
  },
  learningRate: {
    label: 'learning rate',
    explanation:
      'How big each weight update step is during training. Too high and learning oscillates or diverges; too low and progress is painfully slow.',
  },
  epoch: {
    label: 'epoch',
    explanation:
      'One full pass through every training example, updating weights as you go. Hard problems often need many epochs.',
  },
  gradient: {
    label: 'gradient',
    explanation:
      'The direction and amount each weight should move to reduce loss on the current example. Training follows this signal to improve.',
  },
  semanticMemory: {
    label: 'semantic memory',
    explanation:
      'Facts and documents stored outside the live prompt — a durable knowledge base you search at query time instead of pasting everything into every request.',
  },
  contextWindow: {
    label: 'context window',
    explanation:
      'The maximum amount of text a model can read in one request, measured in tokens. Anything beyond that must be summarized, dropped, or fetched separately.',
  },
  embedding: {
    label: 'embedding',
    explanation:
      'A list of numbers representing what a piece of text means. Similar ideas get similar number patterns, which enables search by meaning.',
  },
  retrieval: {
    label: 'retrieval',
    explanation:
      'Fetching the most relevant stored passages for a user question before the model answers — usually by comparing embeddings or keywords.',
  },
  chunk: {
    label: 'chunk',
    explanation:
      'A small slice of source text indexed for search — for example one FAQ entry, one rubric row, or one paragraph from a handbook.',
  },
  prompt: {
    label: 'prompt',
    explanation:
      'The instruction text you send to a language model — task wording, context, and output constraints. Change the prompt to steer behavior without retraining.',
  },
  largeLanguageModel: {
    label: 'large language model',
    explanation:
      'A model trained on vast text so it can follow new instructions in plain language — often called an LLM. You condition it with prompts instead of retraining from scratch.',
  },
  token: {
    label: 'token',
    explanation:
      'A fragment of text the model processes — a whole word, part of a word, or punctuation. Context limits and API costs are measured in tokens, not words.',
  },
  attention: {
    label: 'attention',
    explanation:
      'A transformer mechanism that weighs which prior tokens matter most when predicting the next one — so relevant words get more influence than filler.',
  },
  rubric: {
    label: 'rubric',
    explanation:
      'A structured scoring guide that breaks quality into criterion rows with anchors for each score level — so reviewers and judges apply the same standard.',
  },
  criterion: {
    label: 'criterion',
    explanation:
      'One measurable row in a rubric — for example accuracy, tone, or completeness — scored separately then combined into an overall quality measure.',
  },
  judge: {
    label: 'judge',
    explanation:
      'A model (or reviewer) that scores another model’s answers against a rubric. Automation uses a judge to scale evaluation beyond hand-checking every response.',
  },
  evaluation: {
    label: 'evaluation',
    explanation:
      'Comparing model outputs on shared prompts and rubrics to measure quality — which model answers best, whether a change helped, or if a release regressed.',
  },
  temperature: {
    label: 'temperature',
    explanation:
      'A sampling knob that controls how random the next token choice is. Low temperature (near 0) picks the most likely wording; higher temperature allows more varied phrasing.',
  },
  topP: {
    label: 'top-p',
    explanation:
      'Nucleus sampling: the model considers only the smallest set of likely next tokens whose combined probability reaches p. Lower top-p narrows choices; 1.0 allows the full vocabulary.',
  },
  maxTokens: {
    label: 'max tokens',
    explanation:
      'A hard cap on how many tokens the model may generate in one response. Stops runaway length and controls cost — but can cut answers off mid-sentence if set too low.',
  },
  testCase: {
    label: 'test case',
    explanation:
      'One fixed prompt (plus optional context) you reuse to check model quality — often with known failure modes you want to catch every release.',
  },
  goldenSet: {
    label: 'golden set',
    explanation:
      'A curated collection of test cases and baseline expectations you re-run after changes — your regression guardrail for prompts, models, or rubrics.',
  },
  structuredOutput: {
    label: 'structured output',
    explanation:
      'Machine-readable response format — usually JSON with fixed fields — so automation can parse scores or data without guessing from free-form prose.',
  },
  faithfulness: {
    label: 'faithfulness',
    explanation:
      'Whether an answer stays grounded in the provided source material — citing retrieved chunks or refusing when context is insufficient instead of inventing facts.',
  },
  hallucination: {
    label: 'hallucination',
    explanation:
      'When a model states something confident but unsupported — invented citations, wrong numbers, or facts not present in the prompt or retrieved context.',
  },
  regressionEval: {
    label: 'regression eval',
    explanation:
      'Re-running the same golden set after a change to see if quality dropped — catching prompt edits, model swaps, or provider updates that broke what used to work.',
  },
};

export function isLearnGlossaryTerm(value: string): value is LearnGlossaryTerm {
  return value in LEARN_GLOSSARY;
}
