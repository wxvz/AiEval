import { TEACHING_CORPUS, type CorpusChunk } from './corpus';
import { queryToVector } from './vocabulary';

export interface RankedChunk {
  chunk: CorpusChunk;
  score: number;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function topK(
  queryVector: number[],
  corpus: CorpusChunk[],
  k: number,
): RankedChunk[] {
  const ranked = corpus
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(queryVector, chunk.vector),
    }))
    .sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id));

  return ranked.slice(0, Math.max(0, k));
}

export function rankByQuery(
  query: string,
  k = 3,
  corpus: CorpusChunk[] = TEACHING_CORPUS,
): RankedChunk[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  return topK(queryToVector(trimmed), corpus, k);
}
