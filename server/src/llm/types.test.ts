import { describe, expect, it } from 'vitest';

import { automationStatusFromError } from './types.js';

describe('automationStatusFromError', () => {
  it('maps cancelled messages to cancelled', () => {
    expect(automationStatusFromError('Automation cancelled.')).toBe('cancelled');
  });

  it('maps other errors to failed', () => {
    expect(automationStatusFromError('Automation timed out')).toBe('failed');
  });
});
