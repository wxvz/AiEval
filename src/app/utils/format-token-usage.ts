import { TokenUsageTotals } from '../models';

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }

  if (count >= 10_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }

  if (count >= 1_000) {
    return count.toLocaleString();
  }

  return String(count);
}

export function formatTokenUsageLabel(usage: TokenUsageTotals): string {
  const prefix = usage.estimated ? '~' : '';
  return `${prefix}${formatTokenCount(usage.totalTokens)} tokens`;
}

export function hasTokenUsage(usage: TokenUsageTotals | null | undefined): boolean {
  return !!usage && usage.totalTokens > 0;
}
