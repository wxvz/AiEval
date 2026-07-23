import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DEFAULT_CRITERIA, DEFAULT_EVALUATION_CONFIG, Evaluation, RubricCriterion } from '../models';
import { EvaluationService } from './evaluation.service';
import { FeedbackService } from './feedback.service';

const MONGO_ID = '507f1f77bcf86cd799439011';

describe('EvaluationService criteria modes', () => {
  const customCriterion: RubricCriterion = {
    id: 'custom-accuracy',
    name: 'Custom accuracy',
    description: 'Custom scoring definition',
    maxPoints: 7,
    weight: 1,
  };

  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function createService(evaluations: Evaluation[] = []): Promise<EvaluationService> {
    const service = TestBed.inject(EvaluationService);
    const loadPromise = service.loadFromApi();
    const init = httpMock.expectOne('/api/evaluations');
    init.flush(evaluations);
    await loadPromise;
    return service;
  }

  function savedEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
    return {
      id: MONGO_ID,
      title: 'New evaluation',
      prompt: 'Evaluate these model answers for quality.',
      criteriaMode: 'default',
      criteria: [],
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      answers: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('uses default criteria mode when settings prefer custom but no criteria are provided', async () => {
    localStorage.setItem('aieval-settings-default-criteria-mode', 'custom');

    const service = await createService();

    const createPromise = service.create({
      title: 'Create-page evaluation',
      prompt: 'Title and prompt only, as in full automation.',
    });

    const post = httpMock.expectOne('/api/evaluations');
    expect(post.request.body).toEqual({
      title: 'Create-page evaluation',
      prompt: 'Title and prompt only, as in full automation.',
      criteriaMode: 'default',
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    });
    post.flush(savedEvaluation());

    const created = await createPromise;
    expect(created.criteriaMode).toBe('default');
    expect(service.getActiveCriteria(created)).toEqual(DEFAULT_CRITERIA);
  });

  it('uses custom criteria mode when settings prefer custom and criteria are provided', async () => {
    localStorage.setItem('aieval-settings-default-criteria-mode', 'custom');

    const service = await createService();

    const createPromise = service.create({
      title: 'Custom rubric evaluation',
      prompt: 'Created with custom criteria.',
      criteria: [customCriterion],
    });

    const post = httpMock.expectOne('/api/evaluations');
    expect(post.request.body).toEqual({
      title: 'Custom rubric evaluation',
      prompt: 'Created with custom criteria.',
      criteriaMode: 'custom',
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
      criteria: [customCriterion],
    });
    post.flush(savedEvaluation({ criteriaMode: 'custom', criteria: [customCriterion] }));

    const created = await createPromise;
    expect(created.criteriaMode).toBe('custom');
  });

  it('defaults newly created evaluations to default criteria mode', async () => {
    const service = await createService();

    const createPromise = service.create({
      title: 'New evaluation',
      prompt: 'Evaluate these model answers for quality.',
    });

    const post = httpMock.expectOne('/api/evaluations');
    expect(post.request.body).toEqual({
      title: 'New evaluation',
      prompt: 'Evaluate these model answers for quality.',
      criteriaMode: 'default',
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    });
    post.flush(savedEvaluation());

    const created = await createPromise;
    expect(created.criteriaMode).toBe('default');
    expect(service.getActiveCriteria(created)).toEqual(DEFAULT_CRITERIA);
  });

  it('preserves custom criteria when toggling between default and custom modes', async () => {
    const service = await createService();
    const createPromise = service.create({
      title: 'Mode evaluation',
      prompt: 'Evaluate answers while preserving custom criteria.',
    });
    const post = httpMock.expectOne('/api/evaluations');
    const created = savedEvaluation({
      title: 'Mode evaluation',
      prompt: 'Evaluate answers while preserving custom criteria.',
    });
    post.flush(created);
    await createPromise;

    service.setCriteriaMode(created.id, 'custom');
    httpMock.expectOne(`/api/evaluations/${created.id}`).flush({
      ...created,
      criteriaMode: 'custom',
    });

    service.addCriterion(created.id, {
      name: customCriterion.name,
      description: customCriterion.description,
      maxPoints: customCriterion.maxPoints,
      weight: customCriterion.weight,
    });
    httpMock.expectOne(`/api/evaluations/${created.id}`).flush({
      ...service.getById(created.id)!,
    });

    const customMode = service.getById(created.id) as Evaluation;
    expect(customMode.criteria).toHaveLength(1);

    service.setCriteriaMode(created.id, 'default');
    httpMock.expectOne(`/api/evaluations/${created.id}`).flush({
      ...customMode,
      criteriaMode: 'default',
    });

    const defaultMode = service.getById(created.id) as Evaluation;
    expect(defaultMode.criteria).toEqual(customMode.criteria);
    expect(service.getActiveCriteria(defaultMode)).toEqual(DEFAULT_CRITERIA);

    service.setCriteriaMode(created.id, 'custom');
    httpMock.expectOne(`/api/evaluations/${created.id}`).flush({
      ...defaultMode,
      criteriaMode: 'custom',
    });

    const restoredCustomMode = service.getById(created.id) as Evaluation;
    expect(restoredCustomMode.criteria).toEqual(customMode.criteria);
    expect(service.getActiveCriteria(restoredCustomMode)).toEqual(customMode.criteria);
  });

  it('initializes answer scores from active criteria when adding an answer', async () => {
    const service = await createService();
    const createPromise = service.create({
      title: 'Scored evaluation',
      prompt: 'Evaluate answers with initialized score rows.',
    });
    const post = httpMock.expectOne('/api/evaluations');
    const created = savedEvaluation({
      title: 'Scored evaluation',
      prompt: 'Evaluate answers with initialized score rows.',
    });
    post.flush(created);
    await createPromise;

    service.addAnswer(created.id, {
      label: 'Model A',
      content: 'First model answer.',
    });
    httpMock.expectOne(`/api/evaluations/${created.id}`).flush({
      ...service.getById(created.id)!,
    });

    const answer = service.getById(created.id)!.answers[0];
    expect(answer.scores).toHaveLength(DEFAULT_CRITERIA.length);
    expect(answer.scores.every((score) => score.points === 0)).toBe(true);
    expect(answer.scores.reduce((sum, score) => sum + score.maxPoints, 0)).toBe(
      DEFAULT_CRITERIA.reduce((sum, criterion) => sum + criterion.maxPoints, 0),
    );
  });

  it('returns default criteria only in default mode and saved criteria in custom mode', async () => {
    const service = await createService();
    const createPromise = service.create({
      title: 'Active criteria evaluation',
      prompt: 'Evaluate active criteria behavior across both modes.',
      criteria: [customCriterion],
    });
    const post = httpMock.expectOne('/api/evaluations');
    const created = savedEvaluation({
      title: 'Active criteria evaluation',
      prompt: 'Evaluate active criteria behavior across both modes.',
      criteria: [customCriterion],
    });
    post.flush(created);
    await createPromise;

    expect(service.getActiveCriteria(created)).toEqual(DEFAULT_CRITERIA);

    const customMode = service.setCriteriaMode(created.id, 'custom') as Evaluation;
    httpMock.expectOne(`/api/evaluations/${created.id}`).flush({
      ...customMode,
      criteriaMode: 'custom',
    });

    expect(service.getActiveCriteria(customMode)).toEqual([customCriterion]);
  });

  it('shows feedback on create success and error', async () => {
    const service = await createService();
    const feedback = TestBed.inject(FeedbackService);

    const createPromise = service.create(
      {
        title: 'Feedback evaluation',
        prompt: 'Test feedback on create.',
      },
      {
        success: 'Evaluation created.',
        error: 'Could not create evaluation.',
      },
    );

    const post = httpMock.expectOne('/api/evaluations');
    post.flush(savedEvaluation({ title: 'Feedback evaluation', prompt: 'Test feedback on create.' }));
    await createPromise;

    expect(feedback.feedback()).toEqual({ type: 'success', message: 'Evaluation created.' });

    const failingPromise = service.create(
      {
        title: 'Failing evaluation',
        prompt: 'This create should fail.',
      },
      {
        success: 'Evaluation created.',
        error: 'Could not create evaluation.',
      },
    );

    const failingPost = httpMock.expectOne('/api/evaluations');
    failingPost.error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });

    await expect(failingPromise).rejects.toThrow();
    expect(feedback.feedback()).toEqual({ type: 'danger', message: 'Could not create evaluation.' });
  });

  it('shows feedback on update and delete', async () => {
    const evaluation = savedEvaluation();
    const service = await createService([evaluation]);
    const feedback = TestBed.inject(FeedbackService);

    service.update(
      evaluation.id,
      { title: 'Updated title' },
      {
        success: 'Changes saved.',
        error: 'Could not save changes.',
      },
    );
    httpMock.expectOne(`/api/evaluations/${evaluation.id}`).flush({
      ...evaluation,
      title: 'Updated title',
    });
    expect(feedback.feedback()).toEqual({ type: 'success', message: 'Changes saved.' });

    service.delete(evaluation.id, {
      success: 'Evaluation deleted.',
      error: 'Could not delete evaluation.',
    });
    const deleteRequest = httpMock.expectOne(`/api/evaluations/${evaluation.id}`);
    deleteRequest.flush(null);
    expect(feedback.feedback()).toEqual({ type: 'success', message: 'Evaluation deleted.' });
  });

  it('shows server error message from API response body on create failure', async () => {
    const service = await createService();
    const feedback = TestBed.inject(FeedbackService);

    const createPromise = service.create(
      {
        title: 'Bad evaluation',
        prompt: 'Missing required fields on server.',
      },
      {
        success: 'Evaluation created.',
        error: 'Could not create evaluation.',
      },
    );

    const post = httpMock.expectOne('/api/evaluations');
    post.flush(
      { message: 'title and prompt are required' },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(createPromise).rejects.toThrow('title and prompt are required');
    expect(feedback.feedback()).toEqual({
      type: 'danger',
      message: 'title and prompt are required',
    });
  });

  it('shows server error message from API response body on update failure', async () => {
    const evaluation = savedEvaluation();
    const service = await createService([evaluation]);
    const feedback = TestBed.inject(FeedbackService);

    service.update(
      evaluation.id,
      { title: '' },
      {
        success: 'Changes saved.',
        error: 'Could not save changes.',
      },
    );

    const put = httpMock.expectOne(`/api/evaluations/${evaluation.id}`);
    expect(put.request.body.updatedAt).toBe(evaluation.updatedAt);
    put.flush({ message: 'title and prompt are required' }, { status: 400, statusText: 'Bad Request' });

    expect(feedback.feedback()).toEqual({
      type: 'danger',
      message: 'title and prompt are required',
    });
  });

  it('blocks answer mutations while automation is running', async () => {
    const evaluation = savedEvaluation({
      answers: [
        {
          id: 'a1',
          evaluationId: MONGO_ID,
          label: 'Model A',
          content: 'Answer content here',
          scores: [],
        },
      ],
    });
    const service = await createService([evaluation]);
    const feedback = TestBed.inject(FeedbackService);
    service.automatingEvaluationId.set(evaluation.id);

    const result = service.update(
      evaluation.id,
      { answers: [] },
      {
        success: 'Saved.',
        error: 'Could not save.',
      },
    );

    expect(result).toBeUndefined();
    expect(service.getById(evaluation.id)?.answers).toHaveLength(1);
    expect(feedback.feedback()?.type).toBe('danger');
    httpMock.expectNone(`/api/evaluations/${evaluation.id}`);
  });

  it('does not roll back optimistic update when SSE replaced the evaluation first', async () => {
    const evaluation = savedEvaluation();
    const service = await createService([evaluation]);

    service.update(evaluation.id, { title: 'Optimistic title' });

    const put = httpMock.expectOne(`/api/evaluations/${evaluation.id}`);
    const fromAutomation = savedEvaluation({
      title: 'From automation checkpoint',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    service['replaceEvaluation'](fromAutomation);

    put.flush({ message: 'conflict' }, { status: 409, statusText: 'Conflict' });

    expect(service.getById(evaluation.id)?.title).toBe('From automation checkpoint');
  });

  it('serializes concurrent PUTs for the same evaluation', async () => {
    const evaluation = savedEvaluation();
    const service = await createService([evaluation]);

    service.update(evaluation.id, { title: 'First title xx' });
    service.update(evaluation.id, { title: 'Second title x' });

    const first = httpMock.expectOne(`/api/evaluations/${evaluation.id}`);
    expect(first.request.body.title).toBe('First title xx');
    httpMock.expectNone(`/api/evaluations/${evaluation.id}`);

    first.flush(savedEvaluation({ title: 'First title xx', updatedAt: '2026-01-01T01:00:00.000Z' }));
    // Queued PUT is chained via catch().then(); flush both microtask turns.
    await Promise.resolve();
    await Promise.resolve();

    const second = httpMock.expectOne(`/api/evaluations/${evaluation.id}`);
    expect(second.request.body.title).toBe('Second title x');
    second.flush(savedEvaluation({ title: 'Second title x', updatedAt: '2026-01-01T02:00:00.000Z' }));

    expect(service.getById(evaluation.id)?.title).toBe('Second title x');
  });
});

describe('EvaluationService.generateTitle', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), EvaluationService, FeedbackService],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts with empty body and returns title text', async () => {
    const service = TestBed.inject(EvaluationService);
    const promise = service.generateTitle();

    const req = httpMock.expectOne('/api/evaluations/generate-title');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ evaluationConfig: DEFAULT_EVALUATION_CONFIG });
    req.flush({ title: 'Remote work policy trade-offs' });

    await expect(promise).resolves.toBe('Remote work policy trade-offs');
  });

  it('rejects titles shorter than the minimum length', async () => {
    const service = TestBed.inject(EvaluationService);
    const feedback = TestBed.inject(FeedbackService);
    const errorSpy = vi.spyOn(feedback, 'error');
    const promise = service.generateTitle({ success: '', error: 'Could not generate title.' });

    const req = httpMock.expectOne('/api/evaluations/generate-title');
    req.flush({ title: 'ab' });

    await expect(promise).rejects.toThrow(/too short/);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('EvaluationService.generatePrompt', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), EvaluationService, FeedbackService],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts title and returns prompt text', async () => {
    const service = TestBed.inject(EvaluationService);
    const promise = service.generatePrompt('My evaluation title');

    const req = httpMock.expectOne('/api/evaluations/generate-prompt');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      title: 'My evaluation title',
      evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    });
    req.flush({ prompt: 'Write a detailed explanation of the topic.' });

    await expect(promise).resolves.toBe('Write a detailed explanation of the topic.');
  });

  it('rejects prompts shorter than the minimum length', async () => {
    const service = TestBed.inject(EvaluationService);
    const feedback = TestBed.inject(FeedbackService);
    const errorSpy = vi.spyOn(feedback, 'error');
    const promise = service.generatePrompt('My evaluation title', {
      success: 'Prompt generated.',
      error: 'Could not generate prompt.',
    });

    const req = httpMock.expectOne('/api/evaluations/generate-prompt');
    req.flush({ prompt: 'short' });

    await expect(promise).rejects.toThrow(/too short/);
    expect(errorSpy).toHaveBeenCalled();
  });
});
