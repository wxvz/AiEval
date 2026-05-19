/** Placeholder title/prompt written when starting full automation from the create page. */
export const AUTOMATION_METADATA_STUB = '(automation pending)';

export function needsAutomationMetadataPrep(doc: {
  title: string;
  prompt: string;
  answers: unknown[];
}): boolean {
  if (doc.answers.length > 0) {
    return false;
  }

  const title = doc.title.trim();
  const prompt = doc.prompt.trim();

  return title === prompt && title === AUTOMATION_METADATA_STUB;
}
