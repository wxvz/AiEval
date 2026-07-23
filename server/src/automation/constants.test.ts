import { describe, expect, it } from 'vitest';

import { AUTOMATION_METADATA_STUB_TITLE, AUTOMATION_METADATA_STUB_PROMPT, needsAutomationMetadataPrep } from './constants.js';

describe('needsAutomationMetadataPrep', () => {
  it('returns true for stub title and prompt', () => {
    expect(
      needsAutomationMetadataPrep({
        title: AUTOMATION_METADATA_STUB_TITLE,
        prompt: AUTOMATION_METADATA_STUB_PROMPT,
      }),
    ).toBe(true);
  });

  it('returns false when title and prompt differ', () => {
    expect(
      needsAutomationMetadataPrep({
        title: 'My title',
        prompt: AUTOMATION_METADATA_STUB_PROMPT,
      }),
    ).toBe(false);
  });

  it('returns true for stubs even when answers exist (improved/score parity)', () => {
    expect(
      needsAutomationMetadataPrep({
        title: AUTOMATION_METADATA_STUB_TITLE,
        prompt: AUTOMATION_METADATA_STUB_PROMPT,
      }),
    ).toBe(true);
  });
});
