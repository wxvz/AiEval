import type { LessonContent } from './learn-content';
import type { LearnGlossaryTerm } from './learn-glossary';
import { parseLessonText } from './parse-lesson-text';

function registerTextTerms(
  text: string,
  prefix: string,
  primaryByTerm: Map<LearnGlossaryTerm, string>,
): void {
  const segments = parseLessonText(text);
  segments.forEach((segment, index) => {
    if (segment.kind !== 'term' || primaryByTerm.has(segment.term)) {
      return;
    }
    const hintId = prefix ? `${prefix}-${segment.term}-${index}` : `${segment.term}-${index}`;
    primaryByTerm.set(segment.term, hintId);
  });
}

/** First in-lesson hint id for each glossary term, in reading order. */
export function getPrimaryTermHintIds(content: LessonContent): ReadonlyMap<LearnGlossaryTerm, string> {
  const primary = new Map<LearnGlossaryTerm, string>();

  content.sections.forEach((section, sectionIndex) => {
    const sectionPrefix = `s${sectionIndex}`;

    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      registerTextTerms(paragraph, `${sectionPrefix}-p${paragraphIndex}`, primary);
    });

    section.bullets?.forEach((bullet, bulletIndex) => {
      registerTextTerms(bullet, `${sectionPrefix}-b${bulletIndex}`, primary);
    });

    section.reveals?.forEach((reveal, revealIndex) => {
      registerTextTerms(reveal.prompt, `${sectionPrefix}-r-p${revealIndex}`, primary);
      registerTextTerms(reveal.reveal, `${sectionPrefix}-r-b${revealIndex}`, primary);
    });

    if (section.check) {
      registerTextTerms(section.check.prompt, `${sectionPrefix}-check`, primary);
      registerTextTerms(section.check.explanation, `${sectionPrefix}-check-explanation`, primary);
    }

    if (section.aside?.body) {
      registerTextTerms(section.aside.body, 'aside-tip', primary);
    }
  });

  content.recapQuestions.forEach((question, recapIndex) => {
    registerTextTerms(question.prompt, `recap-${recapIndex}`, primary);
    registerTextTerms(question.explanation, `recap-${recapIndex}-explanation`, primary);
  });

  return primary;
}
