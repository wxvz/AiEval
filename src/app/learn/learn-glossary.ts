export type LearnGlossaryTerm =
  | 'supervisedLearning'
  | 'input'
  | 'target'
  | 'prediction'
  | 'model'
  | 'labeledData'
  | 'dataset'
  | 'trainSet'
  | 'testSet'
  | 'validationSet'
  | 'generalization'
  | 'weights'
  | 'bias'
  | 'activation'
  | 'sigmoid'
  | 'relu'
  | 'tanh'
  | 'memorization'
  | 'classifier'
  | 'hyperparameters'
  | 'loss'
  | 'learningRate'
  | 'epoch'
  | 'gradient'
  | 'reinforcementLearning'
  | 'agent'
  | 'environment'
  | 'reward'
  | 'policy'
  | 'generativeAdversarialNetwork'
  | 'generator'
  | 'discriminator'
  | 'adversarialTraining'
  | 'modeCollapse'
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
  | 'regressionEval'
  | 'toolCall'
  | 'modelContextProtocol'
  | 'host'
  | 'client'
  | 'server'
  | 'multimodalEmbedding'
  | 'vectorDatabase'
  | 'metadata'
  | 'decisionTree'
  | 'feature'
  | 'split'
  | 'leafNode'
  | 'overfitting'
  | 'deepLearning'
  | 'inductiveBias'
  | 'convolutionalNeuralNetwork'
  | 'recurrentNeuralNetwork'
  | 'transformer';

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
      'What you show the model: a photo, a paragraph, two numbers or a user prompt. The model tries to produce an output from this alone.',
  },
  target: {
    label: 'target',
    explanation:
      'The correct answer you want the model to learn for an input: a label, score, category or expected response. Also called the label.',
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
  dataset: {
    label: 'dataset',
    explanation:
      'The collection of input-target pairs the model trains on. Each row teaches what output should appear for a given input.',
  },
  trainSet: {
    label: 'train set',
    explanation:
      'Examples the model is allowed to learn from. Weights are updated using these rows during training.',
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
      'How well the model performs on new inputs it was not trained on, not just on memorized training rows.',
  },
  weights: {
    label: 'weights',
    explanation:
      'Internal numbers the model adjusts during training. Better weights usually mean predictions closer to targets.',
  },
  bias: {
    label: 'bias',
    explanation:
      'A learned offset added after weighted inputs are combined. It shifts the model’s baseline tendency without belonging to any one input.',
  },
  activation: {
    label: 'activation',
    explanation:
      'A function applied after a neuron’s weighted sum and bias. Non-linear activations let stacked layers learn curves instead of one linear map.',
  },
  sigmoid: {
    label: 'sigmoid',
    explanation:
      'An activation that squeezes any score into (0, 1). Often used when the output should look like a probability.',
  },
  relu: {
    label: 'ReLU',
    explanation:
      'Rectified linear unit: returns 0 for negative scores and the score itself for positive values. A common choice in hidden layers.',
  },
  tanh: {
    label: 'tanh',
    explanation:
      'Hyperbolic tangent activation that squeezes scores into (−1, 1), centered at zero.',
  },
  memorization: {
    label: 'memorization',
    explanation:
      'When a model remembers training answers instead of learning a rule. It can score perfectly on training data but fail on new examples.',
  },
  classifier: {
    label: 'classifier',
    explanation:
      'A model that picks a category for an input, for example spam vs not spam or dog vs cat.',
  },
  hyperparameters: {
    label: 'hyperparameters',
    explanation:
      'Settings you choose before training (learning rate, layer size, prompt wording). Not learned from data; you tune them by experiment.',
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
  reinforcementLearning: {
    label: 'reinforcement learning',
    explanation:
      'Learning by interacting with an environment: an agent tries actions, receives rewards or penalties and improves its strategy from those consequences.',
  },
  agent: {
    label: 'agent',
    explanation:
      'The decision-maker in reinforcement learning. It observes the current situation and chooses an action according to its policy.',
  },
  environment: {
    label: 'environment',
    explanation:
      'The world an agent interacts with. It responds to an action with a new situation and a reward signal.',
  },
  reward: {
    label: 'reward',
    explanation:
      'A numeric feedback signal after an action. Reinforcement learning tries to increase long-term reward, so the signal must represent the behavior you actually want.',
  },
  policy: {
    label: 'policy',
    explanation:
      'An agent’s strategy for choosing an action from the current state. Training changes the policy to favor actions with better expected consequences.',
  },
  generativeAdversarialNetwork: {
    label: 'generative adversarial network (GAN)',
    explanation:
      'A pair of models trained in competition: a generator creates synthetic samples while a discriminator learns to distinguish them from real data.',
  },
  generator: {
    label: 'generator',
    explanation:
      'The GAN model that turns random input into synthetic samples and learns to make them resemble the training data.',
  },
  discriminator: {
    label: 'discriminator',
    explanation:
      'The GAN model that predicts whether a sample came from real training data or from the generator.',
  },
  adversarialTraining: {
    label: 'adversarial training',
    explanation:
      'Training models with competing objectives so each model creates a harder learning signal for the other.',
  },
  modeCollapse: {
    label: 'mode collapse',
    explanation:
      'A GAN failure where the generator produces a narrow set of similar outputs instead of covering the variety in the real data.',
  },
  semanticMemory: {
    label: 'semantic memory',
    explanation:
      'Facts and documents stored outside the live prompt: a durable knowledge base you search at query time instead of pasting everything into every request.',
  },
  contextWindow: {
    label: 'context window',
    explanation:
      'The maximum amount of text a model can read in one request, measured in tokens. Anything beyond that must be summarized, dropped or fetched separately.',
  },
  embedding: {
    label: 'embedding',
    explanation:
      'A list of numbers representing what a piece of text means. Similar ideas get similar number patterns, which enables search by meaning.',
  },
  retrieval: {
    label: 'retrieval',
    explanation:
      'Fetching the most relevant stored passages for a user question before the model answers, usually by comparing embeddings or keywords.',
  },
  chunk: {
    label: 'chunk',
    explanation:
      'A small slice of source text indexed for search, for example one FAQ entry, one rubric row or one paragraph from a handbook.',
  },
  prompt: {
    label: 'prompt',
    explanation:
      'The instruction text you send to a language model: task wording, context and output constraints. Change the prompt to steer behavior without retraining.',
  },
  largeLanguageModel: {
    label: 'large language model',
    explanation:
      'A model trained on vast text so it can follow new instructions in plain language (often called an LLM). You condition it with prompts instead of retraining from scratch.',
  },
  token: {
    label: 'token',
    explanation:
      'A fragment of text the model processes: a whole word, part of a word or punctuation. Context limits and API costs are measured in tokens, not words.',
  },
  attention: {
    label: 'attention',
    explanation:
      'A transformer mechanism that weighs which prior tokens matter most when predicting the next one, so relevant words get more influence than filler.',
  },
  rubric: {
    label: 'rubric',
    explanation:
      'A structured scoring guide that breaks quality into criterion rows with anchors for each score level, so reviewers and judges apply the same standard.',
  },
  criterion: {
    label: 'criterion',
    explanation:
      'One measurable row in a rubric (for example accuracy, tone or completeness), scored separately then combined into an overall quality measure.',
  },
  judge: {
    label: 'judge',
    explanation:
      'A model (or reviewer) that scores another model’s answers against a rubric. Automation uses a judge to scale evaluation beyond hand-checking every response.',
  },
  evaluation: {
    label: 'evaluation',
    explanation:
      'Comparing model outputs on shared prompts and rubrics to measure quality: which model answers best, whether a change helped or if a release regressed.',
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
      'A hard cap on how many tokens the model may generate in one response. Stops runaway length and controls cost, but can cut answers off mid-sentence if set too low.',
  },
  testCase: {
    label: 'test case',
    explanation:
      'One fixed prompt (plus optional context) you reuse to check model quality, often with known failure modes you want to catch every release.',
  },
  goldenSet: {
    label: 'golden set',
    explanation:
      'A curated collection of test cases and baseline expectations you re-run after changes: your regression guardrail for prompts, models or rubrics.',
  },
  structuredOutput: {
    label: 'structured output',
    explanation:
      'Machine-readable response format, usually JSON with fixed fields, so automation can parse scores or data without guessing from free-form prose.',
  },
  faithfulness: {
    label: 'faithfulness',
    explanation:
      'Whether an answer stays grounded in the provided source material: citing retrieved chunks or refusing when context is insufficient instead of inventing facts.',
  },
  hallucination: {
    label: 'hallucination',
    explanation:
      'When a model states something confident but unsupported: invented citations, wrong numbers or facts not present in the prompt or retrieved context.',
  },
  regressionEval: {
    label: 'regression eval',
    explanation:
      'Re-running the same golden set after a change to see if quality dropped, catching prompt edits, model swaps or provider updates that broke what used to work.',
  },
  toolCall: {
    label: 'tool call',
    explanation:
      'A model-produced request to run a named external function with structured arguments. The application validates and executes the request, then can return the result to the model.',
  },
  modelContextProtocol: {
    label: 'Model Context Protocol (MCP)',
    explanation:
      'An open protocol for connecting AI applications to external tools, resources and reusable prompts through consistent client-server messages.',
  },
  host: {
    label: 'MCP host',
    explanation:
      'The application that runs the model experience, creates MCP client connections and enforces user-facing policy and permissions.',
  },
  client: {
    label: 'MCP client',
    explanation:
      'The component inside an MCP host that maintains one connection to one server and exchanges protocol messages with it.',
  },
  server: {
    label: 'MCP server',
    explanation:
      'A local or remote program that advertises MCP capabilities such as tools, resources or prompt templates backed by another system.',
  },
  multimodalEmbedding: {
    label: 'multimodal embedding',
    explanation:
      'A numerical representation designed so related content from different media (such as text and images) can be compared in a compatible vector space.',
  },
  vectorDatabase: {
    label: 'vector database',
    explanation:
      'A system that stores embeddings and retrieves nearby vectors, usually alongside source identifiers and metadata used for filtering.',
  },
  metadata: {
    label: 'metadata',
    explanation:
      'Structured facts stored beside content (such as modality, tenant, timestamp or model version) that support filtering, access control and debugging.',
  },
  decisionTree: {
    label: 'decision tree',
    explanation:
      'A model that predicts by following learned feature questions down branches until it reaches a leaf with an answer.',
  },
  feature: {
    label: 'feature',
    explanation:
      'One input field a model can use to make a prediction, for example message length, account type or whether a citation is present.',
  },
  split: {
    label: 'split',
    explanation:
      'A decision-tree question that divides rows into branches using a feature value, category or numerical cutoff.',
  },
  leafNode: {
    label: 'leaf node',
    explanation:
      'The end of a decision-tree path, where the model stores the prediction for rows that followed that path.',
  },
  overfitting: {
    label: 'overfitting',
    explanation:
      'Learning training details so specifically that performance looks strong on seen examples but weakens on new held-out data.',
  },
  deepLearning: {
    label: 'deep learning',
    explanation:
      'Training neural networks with multiple layers so they can build progressively richer representations from data.',
  },
  inductiveBias: {
    label: 'inductive bias',
    explanation:
      'A structural assumption that makes some patterns easier for a model to learn, such as locality in images or order in sequences.',
  },
  convolutionalNeuralNetwork: {
    label: 'convolutional neural network (CNN)',
    explanation:
      'A network that reuses small learned filters across nearby positions, making local repeated patterns easier to detect.',
  },
  recurrentNeuralNetwork: {
    label: 'recurrent neural network (RNN)',
    explanation:
      'A network that processes a sequence step by step while carrying learned state from earlier steps.',
  },
  transformer: {
    label: 'transformer',
    explanation:
      'A neural-network architecture that uses attention to connect relevant positions and supports parallel processing during training.',
  },
};

export function isLearnGlossaryTerm(value: string): value is LearnGlossaryTerm {
  return value in LEARN_GLOSSARY;
}
