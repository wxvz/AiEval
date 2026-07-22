export type RetrievalGlossaryTerm =
  | 'embedding'
  | 'cosineSimilarity'
  | 'topK'
  | 'rag'
  | 'contextWindow';

export interface GlossaryEntry {
  label: string;
  explanation: string;
}

export const RETRIEVAL_GLOSSARY: Record<RetrievalGlossaryTerm, GlossaryEntry> = {
  embedding: {
    label: 'embedding',
    explanation:
      'A list of numbers representing text meaning. Similar ideas get similar number patterns.',
  },
  cosineSimilarity: {
    label: 'cosine similarity',
    explanation:
      'A score from 0 to 1 measuring how aligned two vectors are. Higher means more similar meaning.',
  },
  topK: {
    label: 'top-k',
    explanation: 'Keep only the k highest-scoring search results before passing them to the model.',
  },
  rag: {
    label: 'RAG',
    explanation:
      'Retrieval-augmented generation: fetch relevant text, add it to the prompt, then generate an answer.',
  },
  contextWindow: {
    label: 'context window',
    explanation: 'The maximum prompt size a model can read at once, measured in tokens.',
  },
};
