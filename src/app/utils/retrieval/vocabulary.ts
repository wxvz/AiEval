/** Term → 2D direction used to build a query vector from bag-of-words input. */
const TERM_VECTORS: Record<string, [number, number]> = {
  a: [0.01, 0.01],
  an: [0.01, 0.01],
  the: [0.01, 0.01],
  and: [0.05, 0.05],
  or: [0.05, 0.05],
  to: [0.02, 0.02],
  for: [0.02, 0.02],
  how: [0.1, 0.15],
  what: [0.1, 0.15],
  is: [0.02, 0.02],
  are: [0.02, 0.02],
  evaluation: [0.9, 0.35],
  eval: [0.88, 0.38],
  rubric: [0.92, 0.28],
  criteria: [0.86, 0.32],
  scoring: [0.84, 0.36],
  score: [0.84, 0.36],
  model: [0.5, 0.75],
  models: [0.5, 0.75],
  compare: [0.82, 0.45],
  comparing: [0.82, 0.45],
  prompt: [0.45, 0.88],
  prompts: [0.45, 0.88],
  llm: [0.48, 0.86],
  embedding: [0.72, 0.68],
  embeddings: [0.72, 0.68],
  semantic: [0.76, 0.62],
  search: [0.8, 0.55],
  retrieval: [0.82, 0.52],
  retrieve: [0.82, 0.52],
  cosine: [0.78, 0.58],
  similarity: [0.78, 0.58],
  rag: [0.75, 0.62],
  context: [0.55, 0.78],
  token: [0.52, 0.8],
  tokens: [0.52, 0.8],
  neural: [0.18, 0.92],
  network: [0.2, 0.9],
  networks: [0.2, 0.9],
  train: [0.25, 0.85],
  test: [0.28, 0.82],
  automation: [0.9, 0.38],
  judge: [0.88, 0.4],
  answer: [0.7, 0.5],
  answers: [0.7, 0.5],
  generation: [0.68, 0.55],
  generate: [0.68, 0.55],
};

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

export function queryToVector(query: string): [number, number] {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return [0, 0];
  }

  let x = 0;
  let y = 0;
  let matched = 0;

  for (const token of tokens) {
    const direction = TERM_VECTORS[token];
    if (direction) {
      x += direction[0];
      y += direction[1];
      matched += 1;
    }
  }

  if (matched === 0) {
    return [0.35, 0.35];
  }

  const magnitude = Math.hypot(x, y);
  if (magnitude === 0) {
    return [0, 0];
  }

  return [x / magnitude, y / magnitude];
}
