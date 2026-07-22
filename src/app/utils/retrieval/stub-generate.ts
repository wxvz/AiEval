import { tokenize } from './vocabulary';

export function extractiveAnswer(query: string, context: string): string {
  const trimmedContext = context.trim();
  if (!trimmedContext) {
    return 'No context selected — add retrieved chunks to assemble an answer.';
  }

  const queryTerms = new Set(tokenize(query).filter((term) => term.length > 2));
  const sentences = trimmedContext
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences.length === 0) {
    return `Based on the context: ${trimmedContext.slice(0, 200)}`;
  }

  const scored = sentences.map((sentence) => {
    const words = tokenize(sentence);
    const hits = words.filter((word) => queryTerms.has(word)).length;
    return { sentence, hits };
  });

  scored.sort((left, right) => right.hits - left.hits);
  const best = scored.filter((row) => row.hits > 0).slice(0, 2);

  if (best.length === 0) {
    return `Based on the context: ${sentences[0]}`;
  }

  return `Based on the retrieved context: ${best.map((row) => row.sentence).join(' ')}`;
}
