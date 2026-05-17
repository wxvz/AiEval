import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DEFAULT_CRITERIA, Evaluation, RubricCriterion } from '../models';
import { EvaluationService } from './evaluation.service';
import { FeedbackService } from './feedback.service';

const MONGO_ID = '507f1f77bcf86cd799439011';

describe('EvaluationService criteria modes', () => {
  const customCriterion: RubricCriterion = {
    id: 'custom-accuracy',
    name: 'Custom accuracy',
    description: 'Custom scoring definition',
    maxPoints: 7,
  };

  let httpMock: HttpTestingController;

  beforeEach(() => {
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

  function legacyEvaluation(): Evaluation {
    return {
      id: 'legacy-evaluation',
      title: 'Legacy evaluation',
      prompt: 'This is a legacy evaluation prompt.',
      criteria: [customCriterion],
      answers: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  function savedEvaluation(overrides: Partial<Evaluation> = {}): Evaluation {
    return {
      id: MONGO_ID,
      title: 'New evaluation',
      prompt: 'Evaluate these model answers for quality.',
      criteriaMode: 'default',
      criteria: [],
      answers: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

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
    });
    post.flush(savedEvaluation());

    const created = await createPromise;
    expect(created.criteriaMode).toBe('default');
    expect(service.getActiveCriteria(created)).toEqual(DEFAULT_CRITERIA);
  });

  it('treats existing evaluations without criteriaMode as custom criteria mode', async () => {
    const service = await createService([legacyEvaluation()]);
    const evaluation = service.getById('legacy-evaluation');

    expect(evaluation).toBeTruthy();
    expect(evaluation?.criteriaMode).toBeUndefined();
    expect(service.getActiveCriteria(evaluation as Evaluation)).toEqual([customCriterion]);
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
});
