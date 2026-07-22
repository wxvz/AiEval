export interface CorpusChunk {
  id: string;
  text: string;
  tags: string[];
  vector: [number, number];
}

/** Teaching corpus — 2D vectors are simplified; production systems use hundreds of dimensions. */
export const TEACHING_CORPUS: CorpusChunk[] = [
  {
    id: 'rubric-basics',
    text: 'A rubric breaks answer quality into scorable criteria with clear anchors at each point level.',
    tags: ['rubric', 'evaluation', 'scoring'],
    vector: [0.92, 0.28],
  },
  {
    id: 'compare-models',
    text: 'Model evaluation compares multiple answers to the same prompt and picks a winner using criteria.',
    tags: ['evaluation', 'models', 'compare'],
    vector: [0.88, 0.42],
  },
  {
    id: 'prompt-instructions',
    text: 'Prompts are instructions that condition a language model on the task, tone, and output format.',
    tags: ['prompt', 'llm', 'instructions'],
    vector: [0.45, 0.88],
  },
  {
    id: 'embeddings-meaning',
    text: 'Embeddings map text into vectors so similar meaning lands closer together in vector space.',
    tags: ['embedding', 'semantic', 'retrieval'],
    vector: [0.72, 0.68],
  },
  {
    id: 'cosine-similarity',
    text: 'Cosine similarity measures the angle between two vectors — a common score for semantic search.',
    tags: ['cosine', 'similarity', 'retrieval'],
    vector: [0.78, 0.58],
  },
  {
    id: 'top-k-retrieval',
    text: 'Top-k retrieval returns the k highest-scoring chunks for a query before generation.',
    tags: ['retrieval', 'top-k', 'rag'],
    vector: [0.82, 0.52],
  },
  {
    id: 'rag-pipeline',
    text: 'RAG retrieves relevant documents, adds them to the prompt context, then asks the model to answer.',
    tags: ['rag', 'retrieval', 'generation'],
    vector: [0.75, 0.62],
  },
  {
    id: 'context-window',
    text: 'Models have a context window limit — only so many tokens of prompt plus retrieved text fit at once.',
    tags: ['context', 'tokens', 'rag'],
    vector: [0.55, 0.78],
  },
  {
    id: 'neural-network',
    text: 'A neural network learns from labeled examples by adjusting weights to reduce prediction error.',
    tags: ['neural', 'network', 'training'],
    vector: [0.18, 0.92],
  },
  {
    id: 'train-test-split',
    text: 'Hold out a test set so you measure generalization instead of memorization on training data.',
    tags: ['train', 'test', 'generalization'],
    vector: [0.25, 0.85],
  },
  {
    id: 'automation-judge',
    text: 'An AI judge can score answers automatically, but human review still matters for high-stakes decisions.',
    tags: ['automation', 'judge', 'evaluation'],
    vector: [0.9, 0.38],
  },
];
