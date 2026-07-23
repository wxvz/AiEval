/** Placeholder title/prompt written when starting full automation from the create page. */
export const AUTOMATION_METADATA_STUB_TITLE = '(automation pending)';
export const AUTOMATION_METADATA_STUB_PROMPT = '(if message persists, retry the automation)';

export function needsAutomationMetadataPrep(doc: {
  title: string;
  prompt: string;
}): boolean {
  const title = doc.title.trim();
  const prompt = doc.prompt.trim();

  return title === AUTOMATION_METADATA_STUB_TITLE && prompt === AUTOMATION_METADATA_STUB_PROMPT;
}
