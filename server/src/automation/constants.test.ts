import { describe, expect, it } from 'vitest';

import { AUTOMATION_METADATA_STUB_TITLE, AUTOMATION_METADATA_STUB_PROMPT, needsAutomationMetadataPrep } from './constants.js';

describe('needsAutomationMetadataPrep', () => {
  it('returns true for stub doc with no answers', () => {
    expect(
      needsAutomationMetadataPrep({
        title: AUTOMATION_METADATA_STUB_TITLE,
        prompt: AUTOMATION_METADATA_STUB_PROMPT,
        answers: [],
      }),
    ).toBe(true);
  });

  it('returns false when title and prompt differ', () => {
    expect(
      needsAutomationMetadataPrep({
        title: 'My title',
        prompt: AUTOMATION_METADATA_STUB_PROMPT,
        answers: [],
      }),
    ).toBe(false);
  });

  it('returns false when answers exist', () => {
    expect(
      needsAutomationMetadataPrep({
        title: AUTOMATION_METADATA_STUB_TITLE,
        prompt: AUTOMATION_METADATA_STUB_PROMPT ,
        answers: [{}],
      }),
    ).toBe(false);
  });
});
