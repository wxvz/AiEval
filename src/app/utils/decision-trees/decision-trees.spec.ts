import { describe, expect, it } from 'vitest';

import {
  TARGET_FEATURE,
  TICKET_ROWS,
  accuracy,
  isComplete,
  isSolved,
  partitionRows,
  predict,
} from './decision-trees';

describe('decision-trees engine', () => {
  it('exposes four labeled ticket rows', () => {
    expect(TICKET_ROWS).toHaveLength(4);
  });

  it('partitions cleanly on mentionsRefund', () => {
    const { yes, no } = partitionRows(TICKET_ROWS, 'mentionsRefund');
    expect(yes.every((row) => row.label === 'billing')).toBe(true);
    expect(no.every((row) => row.label === 'access')).toBe(true);
  });

  it('does not separate labels with accountLocked alone', () => {
    const { yes, no } = partitionRows(TICKET_ROWS, 'accountLocked');
    expect(new Set(yes.map((row) => row.label)).size).toBeGreaterThan(1);
    expect(no.some((row) => row.label === 'billing')).toBe(true);
  });

  it('predicts from a one-split tree', () => {
    const tree = {
      feature: 'mentionsRefund' as const,
      yesLabel: 'billing' as const,
      noLabel: 'access' as const,
    };
    expect(predict(TICKET_ROWS[0]!, tree)).toBe('billing');
    expect(predict(TICKET_ROWS[3]!, tree)).toBe('access');
    expect(accuracy(TICKET_ROWS, tree)).toBe(1);
  });

  it('requires a complete tree before solving', () => {
    expect(isComplete({ feature: null, yesLabel: null, noLabel: null })).toBe(false);
    expect(
      isSolved({
        feature: TARGET_FEATURE,
        yesLabel: 'billing',
        noLabel: 'access',
      }),
    ).toBe(true);
    expect(
      isSolved({
        feature: 'accountLocked',
        yesLabel: 'access',
        noLabel: 'billing',
      }),
    ).toBe(false);
  });
});
