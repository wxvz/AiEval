import { computed, inject } from '@angular/core';

import { TokenUsageTotals } from '../models';
import { EvaluationService } from '../services/evaluation.service';

/** Shared automating + token usage signals for evaluation pages with automation. */
export function useAutomationPageContext(evaluationId: () => string | null) {
  const evaluationService = inject(EvaluationService);

  const automating = computed(() => {
    const id = evaluationId();

    return id ? evaluationService.isAutomating(id) : false;
  });

  const displayTokenUsage = computed((): TokenUsageTotals | null | undefined => {
    const id = evaluationId();

    if (!id) {
      return null;
    }

    const current = evaluationService.getById(id);

    if (automating()) {
      return evaluationService.getAutomationTokenUsage(id) ?? current?.tokenUsage;
    }

    return current?.tokenUsage;
  });

  return { automating, displayTokenUsage };
}
