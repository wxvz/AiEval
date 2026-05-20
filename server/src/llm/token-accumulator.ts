import type { TokenUsageTotals } from '../types/token-usage.js';
import type { LlmTokenUsage } from './types.js';

export interface TokenAccumulator {
  add(usage: LlmTokenUsage): void;
  totals(): TokenUsageTotals;
}

export function createTokenAccumulator(initial?: TokenUsageTotals): TokenAccumulator {
  let promptTokens = initial?.promptTokens ?? 0;
  let completionTokens = initial?.completionTokens ?? 0;
  let totalTokens = initial?.totalTokens ?? 0;
  let estimated = initial?.estimated ?? false;

  return {
    add(usage: LlmTokenUsage) {
      promptTokens += usage.promptTokens;
      completionTokens += usage.completionTokens;
      totalTokens += usage.totalTokens;
      estimated = estimated || !!usage.estimated;
    },
    totals(): TokenUsageTotals {
      return {
        promptTokens,
        completionTokens,
        totalTokens,
        ...(estimated ? { estimated: true } : {}),
      };
    },
  };
}
