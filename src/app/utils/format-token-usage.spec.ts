import { formatTokenCount, formatTokenUsageLabel, hasTokenUsage } from './format-token-usage';

describe('formatTokenCount', () => {
  it('formats compact and full numbers', () => {
    expect(formatTokenCount(500)).toBe('500');
    expect(formatTokenCount(1500)).toBe('1,500');
    expect(formatTokenCount(12450)).toBe('12.4k');
    expect(formatTokenCount(2_500_000)).toBe('2.5M');
  });
});

describe('formatTokenUsageLabel', () => {
  it('includes estimated prefix', () => {
    expect(
      formatTokenUsageLabel({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        estimated: true,
      }),
    ).toBe('~30 tokens');
  });
});

describe('hasTokenUsage', () => {
  it('is false for empty or missing usage', () => {
    expect(hasTokenUsage(undefined)).toBe(false);
    expect(hasTokenUsage({ promptTokens: 0, completionTokens: 0, totalTokens: 0 })).toBe(false);
  });

  it('is true when total tokens are positive', () => {
    expect(hasTokenUsage({ promptTokens: 1, completionTokens: 2, totalTokens: 3 })).toBe(true);
  });
});
