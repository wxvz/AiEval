export interface TokenUsageTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** True if any contributing call used the estimate fallback. */
  estimated?: boolean;
}
