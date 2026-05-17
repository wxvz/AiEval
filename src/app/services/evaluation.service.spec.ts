import { TestBed } from '@angular/core/testing';

import { DEFAULT_CRITERIA, Evaluation, RubricCriterion } from '../models';
import { EvaluationService } from './evaluation.service';

describe('EvaluationService criteria modes', () => {
  const customCriterion: RubricCriterion = {
    id: 'custom-accuracy',
    name: 'Custom accuracy',
    description: 'Custom scoring definition',
    maxPoints: 7,
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  function createService(): EvaluationService {
    TestBed.configureTestingModule({});
    return TestBed.inject(EvaluationService);
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

  it('defaults newly created evaluations to default criteria mode', () => {
    const service = createService();

    const created = service.create({
      title: 'New evaluation',
      prompt: 'Evaluate these model answers for quality.',
    });

    expect(created.criteriaMode).toBe('default');
    expect(service.getActiveCriteria(created)).toEqual(DEFAULT_CRITERIA);
  });

  it('treats existing evaluations without criteriaMode as custom criteria mode', () => {
    localStorage.setItem('ai-eval-evaluations', JSON.stringify([legacyEvaluation()]));
    const service = createService();
    const evaluation = service.getById('legacy-evaluation');

    expect(evaluation).toBeTruthy();
    expect(evaluation?.criteriaMode).toBeUndefined();
    expect(service.getActiveCriteria(evaluation as Evaluation)).toEqual([customCriterion]);
  });

  it('preserves custom criteria when toggling between default and custom modes', () => {
    const service = createService();
    const created = service.create({
      title: 'Mode evaluation',
      prompt: 'Evaluate answers while preserving custom criteria.',
    });

    service.setCriteriaMode(created.id, 'custom');
    service.addCriterion(created.id, {
      name: customCriterion.name,
      description: customCriterion.description,
      maxPoints: customCriterion.maxPoints,
    });

    const customMode = service.getById(created.id) as Evaluation;
    expect(customMode.criteria).toHaveLength(1);

    service.setCriteriaMode(created.id, 'default');
    const defaultMode = service.getById(created.id) as Evaluation;
    expect(defaultMode.criteria).toEqual(customMode.criteria);
    expect(service.getActiveCriteria(defaultMode)).toEqual(DEFAULT_CRITERIA);

    service.setCriteriaMode(created.id, 'custom');
    const restoredCustomMode = service.getById(created.id) as Evaluation;
    expect(restoredCustomMode.criteria).toEqual(customMode.criteria);
    expect(service.getActiveCriteria(restoredCustomMode)).toEqual(customMode.criteria);
  });

  it('returns default criteria only in default mode and saved criteria in custom mode', () => {
    const service = createService();
    const created = service.create({
      title: 'Active criteria evaluation',
      prompt: 'Evaluate active criteria behavior across both modes.',
      criteria: [customCriterion],
    });

    expect(service.getActiveCriteria(created)).toEqual(DEFAULT_CRITERIA);

    const customMode = service.setCriteriaMode(created.id, 'custom') as Evaluation;
    expect(service.getActiveCriteria(customMode)).toEqual([customCriterion]);
  });
});
