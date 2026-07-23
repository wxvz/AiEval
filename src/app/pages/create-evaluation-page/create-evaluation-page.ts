import { Component, DestroyRef, computed, effect, HostListener, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AutomationControlsComponent } from '../../components/automation-controls/automation-controls';
import {
  EvaluationForm,
  EvaluationFormValue,
} from '../../components/evaluation-form/evaluation-form';
import { LeaveDuringAutomationComponent } from '../../components/leave-during-automation/leave-during-automation';
import { TokenUsageBadge } from '../../components/token-usage-badge/token-usage-badge';
import { Evaluation, CriteriaMode, RubricCriterion } from '../../models';
import { AUTOMATION_METADATA_STUB_TITLE, AUTOMATION_METADATA_STUB_PROMPT } from '../../../../server/src/automation/constants';
import { loadWalkthroughContent } from '../../learn/walkthrough-content';
import { LearnHandoffService } from '../../learn/learn-handoff.service';
import {
  EvaluationService,
  MIN_GENERATED_PROMPT_LENGTH,
  MIN_GENERATED_TITLE_LENGTH,
} from '../../services/evaluation.service';
import { TemplateService } from '../../services/template.service';
import { useAutomationPageContext } from '../../utils/automation-page-context';

type AppliedTemplateRubric = {
  criteriaMode: CriteriaMode;
  criteria: RubricCriterion[];
};

@Component({
  selector: 'app-create-evaluation-page',
  imports: [
    RouterLink,
    EvaluationForm,
    AutomationControlsComponent,
    LeaveDuringAutomationComponent,
    TokenUsageBadge,
  ],
  templateUrl: './create-evaluation-page.html',
  styleUrl: './create-evaluation-page.css',
})
export class CreateEvaluationPage {
  private readonly evaluationService = inject(EvaluationService);
  private readonly templateService = inject(TemplateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly learnHandoff = inject(LearnHandoffService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly evaluationForm = viewChild(EvaluationForm);
  private readonly leaveDuringAutomation = viewChild(LeaveDuringAutomationComponent);

  protected readonly createdEvaluationId = signal<string | null>(null);
  private readonly automationPage = useAutomationPageContext(() => this.createdEvaluationId());

  protected readonly completedEvaluationIds = signal<string[]>([]);
  private readonly automationSessionKey = signal(0);
  protected readonly generatingPrompt = signal(false);
  protected readonly creating = signal(false);
  private readonly formFieldsVersion = signal(0);
  private generatePromptAbort: AbortController | null = null;
  protected readonly fromLearn = signal(
    this.learnHandoff.isLearnContext(this.route.snapshot.queryParamMap.get('from')),
  );
  protected readonly learnHint = loadWalkthroughContent().handoffCopy?.createPageHint ?? null;
  protected readonly templates = this.templateService.templates;
  /** Rubric from last applied template — form DTO does not carry criteriaMode/criteria. */
  private readonly appliedTemplateRubric = signal<AppliedTemplateRubric | null>(null);

  protected readonly automating = this.automationPage.automating;
  protected readonly displayTokenUsage = this.automationPage.displayTokenUsage;

  protected readonly activeAutomationSession = computed(() => {
    const id = this.createdEvaluationId();
    const key = this.automationSessionKey();

    if (!id) {
      return [] as { key: string; evaluationId: string }[];
    }

    return [{ key: `${key}:${id}`, evaluationId: id }];
  });

  protected readonly showActiveAutomationControls = computed(() => {
    const id = this.createdEvaluationId();

    if (!id) {
      return false;
    }

    if (this.automating()) {
      return true;
    }

    if (!this.automationComplete()) {
      return true;
    }

    return !this.completedEvaluationIds().includes(id);
  });

  constructor() {
    void this.templateService.loadFromApi();
    this.destroyRef.onDestroy(() => this.cancelGeneratePrompt());

    effect((onCleanup) => {
      const form = this.evaluationForm();

      if (!form) {
        return;
      }

      const subscription = form.form.valueChanges.subscribe(() => {
        this.formFieldsVersion.update((version) => version + 1);
      });

      this.formFieldsVersion.update((version) => version + 1);

      onCleanup(() => subscription.unsubscribe());
    });

    effect(() => {
      if (!this.automating()) {
        return;
      }

      const id = this.createdEvaluationId();

      if (!id) {
        return;
      }

      const evaluation = this.evaluationService.getById(id);

      if (evaluation) {
        this.syncFormFromEvaluation(evaluation);
      }
    });
  }

  protected readonly automationBlocksActions = computed(() => {
    const id = this.createdEvaluationId();

    if (!id) {
      return this.evaluationService.isAutomating();
    }

    const evaluation = this.evaluationService.getById(id);

    if (evaluation?.automatedAt) {
      return false;
    }

    return this.evaluationService.isAutomating(id);
  });

  protected readonly hasPartialFormForAutomation = computed(() => {
    this.formFieldsVersion();

    const form = this.evaluationForm();

    if (!form) {
      return false;
    }

    const { title, prompt } = form.getValue();
    const hasTitle = title.trim().length > 0;
    const hasPrompt = prompt.trim().length > 0;

    return hasTitle !== hasPrompt;
  });

  protected readonly canRunFullAutomation = computed(
    () =>
      !this.creating() &&
      !this.automationBlocksActions() &&
      !this.createdEvaluationId() &&
      !this.hasPartialFormForAutomation(),
  );

  protected readonly canRunNewFullAutomation = computed(
    () =>
      this.showFullAutomationRerun() && !this.creating() && !this.automationBlocksActions(),
  );

  protected readonly showFullAutomationRerun = computed(
    () => !!this.createdEvaluationId() && this.automationComplete(),
  );

  protected readonly automationComplete = computed(() => {
    const id = this.createdEvaluationId();

    if (!id) {
      return false;
    }

    const evaluation = this.evaluationService.getById(id);

    return !!evaluation?.automatedAt && !this.automating();
  });

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.automating() || this.generatingPrompt()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.generatingPrompt()) {
      this.cancelGeneratePrompt();
      return true;
    }

    if (!this.automating()) {
      return true;
    }

    return this.leaveDuringAutomation()?.prompt() ?? true;
  }

  protected onSubmit(value: EvaluationFormValue): void {
    void this.createEvaluation(value)
      .then((created) => {
        this.recordLearnHandoff(created.id);
        void this.router.navigate(['/evaluations', created.id, 'edit']);
      })
      .catch(() => undefined);
  }

  protected onGeneratePrompt(): Promise<void> {
    const form = this.evaluationForm();

    if (!form) {
      return Promise.resolve();
    }

    if (this.generatingPrompt() || this.creating() || this.automationBlocksActions()) {
      return Promise.resolve();
    }

    const needsGeneratedTitle = !form.isTitleValid();

    if (
      !needsGeneratedTitle &&
      form.getValue().prompt.trim().length > 0 &&
      !window.confirm('Replace the current prompt with a newly generated one?')
    ) {
      return Promise.resolve();
    }

    this.cancelGeneratePrompt();
    const abortController = new AbortController();
    this.generatePromptAbort = abortController;
    this.generatingPrompt.set(true);

    const evaluationConfig = form.getValue().evaluationConfig;

    const titlePromise = needsGeneratedTitle
      ? this.evaluationService.generateTitle(
          evaluationConfig,
          {
            success: '',
            error: 'Could not generate title.',
          },
          { signal: abortController.signal },
        )
      : Promise.resolve(form.getValue().title.trim());

    return titlePromise
      .then((title) =>
        this.evaluationService
          .generatePrompt(
            title,
            evaluationConfig,
            {
              success: 'Prompt generated.',
              error: 'Could not generate prompt.',
            },
            { signal: abortController.signal },
          )
          .then((prompt) => ({ title, prompt })),
      )
      .then(({ title, prompt }) => {
        if (abortController.signal.aborted) {
          return;
        }

        const trimmedTitle = title.trim();
        const trimmedPrompt = prompt.trim();

        // Do not mutate the form with under-length LLM responses (service also guards).
        if (
          trimmedTitle.length < MIN_GENERATED_TITLE_LENGTH ||
          trimmedPrompt.length < MIN_GENERATED_PROMPT_LENGTH
        ) {
          return;
        }

        form.setTitle(trimmedTitle);
        form.setPrompt(trimmedPrompt);
      })
      .catch(() => undefined)
      .finally(() => {
        if (this.generatePromptAbort === abortController) {
          this.generatePromptAbort = null;
          this.generatingPrompt.set(false);
        }
      });
  }

  protected applyTemplate(templateId: string): void {
    const template = this.templateService.templates().find((item) => item.id === templateId);
    const form = this.evaluationForm();

    if (!template || !form) {
      return;
    }

    form.form.patchValue({
      title: template.title,
      prompt: template.prompt,
      taskDifficulty: template.evaluationConfig.taskDifficulty,
      goal: template.evaluationConfig.goal,
      audience: template.evaluationConfig.audience,
      blindJudging: template.evaluationConfig.blindJudging,
      strictness: template.evaluationConfig.judgeProfile.strictness,
      format: template.evaluationConfig.responseConstraints.format,
      maxWords: template.evaluationConfig.responseConstraints.maxWords ?? null,
      requireCitations: template.evaluationConfig.responseConstraints.requireCitations,
      requireCode: template.evaluationConfig.responseConstraints.requireCode,
      requireTests: template.evaluationConfig.responseConstraints.requireTests,
      expectedAnswer: template.evaluationConfig.expectedAnswer ?? '',
      judgeModel: template.evaluationConfig.judgeProfile.model ?? '',
    });

    this.appliedTemplateRubric.set({
      criteriaMode: template.criteriaMode,
      criteria: template.criteria.map((criterion) => ({ ...criterion })),
    });
  }

  private cancelGeneratePrompt(): void {
    this.generatePromptAbort?.abort();
    this.generatePromptAbort = null;
    this.generatingPrompt.set(false);
  }

  protected getEvaluation(id: string): Evaluation | undefined {
    return this.evaluationService.getById(id);
  }

  protected onAutomationFinished(evaluation: Evaluation): void {
    this.applyAutomationResult(evaluation);
  }

  protected onAutomationStatusDismissed(): void {
    const id = this.createdEvaluationId();

    if (!id) {
      return;
    }

    const evaluation = this.evaluationService.getById(id);

    if (evaluation) {
      this.applyAutomationResult(evaluation);
    }
  }

  protected onRunFullAutomation(): Promise<void> {
    if (!this.canRunFullAutomation()) {
      return Promise.resolve();
    }

    return this.startFullAutomation({ useFormValues: true });
  }

  protected onRunNewFullAutomation(): Promise<void> {
    if (!this.canRunNewFullAutomation()) {
      return Promise.resolve();
    }

    const currentId = this.createdEvaluationId();

    if (currentId) {
      this.rememberCompletedEvaluation(currentId);
    }

    return this.startFullAutomation({ clearForm: true });
  }

  private applyAutomationResult(evaluation: Evaluation): void {
    this.rememberCompletedEvaluation(evaluation.id);
    this.recordLearnHandoff(evaluation.id);
    this.syncFormFromEvaluation(evaluation);
  }

  private startFullAutomation(options: {
    clearForm?: boolean;
    useFormValues?: boolean;
  }): Promise<void> {
    const form = this.evaluationForm();

    if (options.clearForm && form) {
      form.resetForNewAutomation();
      this.appliedTemplateRubric.set(null);
    }

    const value = options.useFormValues
      ? this.resolveFullAutomationCreateValue()
      : this.stubCreateValue();

    this.creating.set(true);

    return this.createEvaluation(value)
      .then((created) => {
        this.automationSessionKey.update((key) => key + 1);
        this.createdEvaluationId.set(created.id);
        this.recordLearnHandoff(created.id);
      })
      .catch(() => undefined)
      .finally(() => {
        this.creating.set(false);
      });
  }

  private rememberCompletedEvaluation(id: string): void {
    const evaluation = this.evaluationService.getById(id);

    if (!evaluation?.automatedAt) {
      return;
    }

    this.completedEvaluationIds.update((ids) =>
      ids.includes(id) ? ids : [...ids, id],
    );
  }

  private stubCreateValue(): EvaluationFormValue {
    const evaluationConfig = this.evaluationForm()?.getValue().evaluationConfig;

    return {
      title: AUTOMATION_METADATA_STUB_TITLE,
      prompt: AUTOMATION_METADATA_STUB_PROMPT,
      evaluationConfig:
        evaluationConfig ??
        {
          taskDifficulty: 'balanced',
          goal: 'general',
          audience: 'general',
          responseConstraints: {
            format: 'freeform',
            requireCitations: false,
            requireCode: false,
            requireTests: false,
          },
          blindJudging: true,
          judgeProfile: { strictness: 'balanced' },
        },
    };
  }

  private resolveFullAutomationCreateValue(): EvaluationFormValue {
    const form = this.evaluationForm();

    if (!form) {
      return this.stubCreateValue();
    }

    const { title, prompt } = form.getValue();
    const trimmedTitle = title.trim();
    const trimmedPrompt = prompt.trim();

    if (trimmedTitle.length > 0 && trimmedPrompt.length > 0) {
      return { title: trimmedTitle, prompt: trimmedPrompt, evaluationConfig: form.getValue().evaluationConfig };
    }

    return this.stubCreateValue();
  }

  private createEvaluation(value: EvaluationFormValue): Promise<Evaluation> {
    const rubric = this.appliedTemplateRubric();

    return this.evaluationService.create(
      {
        ...value,
        ...(rubric
          ? {
              criteriaMode: rubric.criteriaMode,
              ...(rubric.criteriaMode === 'custom' ? { criteria: rubric.criteria } : {}),
            }
          : {}),
      },
      {
        success: 'Evaluation created.',
        error: 'Could not create evaluation.',
      },
    );
  }

  private syncFormFromEvaluation(evaluation: Evaluation): void {
    const form = this.evaluationForm();

    if (!form) {
      return;
    }

    const title = evaluation.title.trim();
    const prompt = evaluation.prompt.trim();

    if (title && title !== AUTOMATION_METADATA_STUB_TITLE) {
      form.setTitle(title);
    }

    if (prompt && prompt !== AUTOMATION_METADATA_STUB_PROMPT  ) {
      form.setPrompt(prompt);
    }
  }

  private recordLearnHandoff(evaluationId: string): void {
    if (!this.fromLearn()) {
      return;
    }
    this.learnHandoff.recordEvaluation(evaluationId);
  }
}
