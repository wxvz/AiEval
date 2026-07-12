import { tokenize } from '../retrieval/vocabulary';

export type SupportLabel = 'supported' | 'unsupported' | 'unknown';

export interface SentenceSupport {
  sentence: string;
  label: SupportLabel;
  overlapRatio: number;
}

function significantTerms(text: string): Set<string> {
  return new Set(tokenize(text).filter((term) => term.length > 2));
}

export function classifySentenceSupport(sentence: string, context: string): SentenceSupport {
  const sentenceTerms = significantTerms(sentence);
  if (sentenceTerms.size === 0) {
    return { sentence, label: 'unknown', overlapRatio: 0 };
  }

  const contextTerms = significantTerms(context);
  let hits = 0;
  for (const term of sentenceTerms) {
    if (contextTerms.has(term)) {
      hits += 1;
    }
  }

  const overlapRatio = hits / sentenceTerms.size;
  let label: SupportLabel = 'unsupported';
  if (overlapRatio >= 0.55) {
    label = 'supported';
  } else if (overlapRatio >= 0.3) {
    label = 'unknown';
  }

  return { sentence, label, overlapRatio };
}

export function classifyAnswerSupport(answer: string, context: string): SentenceSupport[] {
  const sentences = answer
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  return sentences.map((sentence) => classifySentenceSupport(sentence, context));
}

export const FAITHFULNESS_CONTEXT =
  'Plan Basic costs $9 per month and includes email support. Plan Pro costs $19 per month and adds phone support. Refunds are available within 14 days of purchase.';

export const FAITHFULNESS_ANSWER =
  'Plan Basic is $9 per month with email support. Plan Pro includes phone support and costs $19 monthly. We offer refunds within 14 days. We offer free lifetime warranties worldwide.';
