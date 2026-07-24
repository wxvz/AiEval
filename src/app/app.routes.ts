import { Routes } from '@angular/router';

import { automationCanDeactivateGuard } from './guards/automation-can-deactivate.guard';
import { DashboardPage } from './pages/dashboard-page/dashboard-page';

export const routes: Routes = [
  { path: '', component: DashboardPage },
  {
    path: 'evaluations/new',
    loadComponent: () =>
      import('./pages/create-evaluation-page/create-evaluation-page').then(
        (m) => m.CreateEvaluationPage,
      ),
    canDeactivate: [automationCanDeactivateGuard],
  },
  {
    path: 'evaluations/:id/edit',
    loadComponent: () =>
      import('./pages/edit-evaluation-page/edit-evaluation-page').then(
        (m) => m.EditEvaluationPage,
      ),
    canDeactivate: [automationCanDeactivateGuard],
  },
  {
    path: 'evaluations/:id/compare',
    loadComponent: () =>
      import('./pages/compare-answers-page/compare-answers-page').then(
        (m) => m.CompareAnswersPage,
      ),
    canDeactivate: [automationCanDeactivateGuard],
  },
  {
    path: 'evaluations/:id/improved',
    loadComponent: () =>
      import('./pages/improved-answer-page/improved-answer-page').then(
        (m) => m.ImprovedAnswerPage,
      ),
    canDeactivate: [automationCanDeactivateGuard],
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./pages/about-page/about-page').then((m) => m.AboutPage),
  },
  {
    path: 'learn',
    loadComponent: () =>
      import('./pages/learn-page/learn-page').then((m) => m.LearnPage),
  },
  {
    path: 'learn/lessons/:lessonId',
    loadComponent: () =>
      import('./pages/learn-lesson-page/learn-lesson-page').then(
        (m) => m.LearnLessonPage,
      ),
  },
  {
    path: 'learn/labs/neural-network',
    loadComponent: () =>
      import('./pages/nn-playground/nn-playground').then((m) => m.NnPlaygroundPage),
  },
  {
    path: 'learn/labs/learning-from-examples',
    loadComponent: () =>
      import('./pages/learning-from-examples-lab/learning-from-examples-lab').then(
        (m) => m.LearningFromExamplesLabPage,
      ),
  },
  {
    path: 'learn/labs/what-is-a-dataset',
    loadComponent: () =>
      import('./pages/what-is-a-dataset-lab/what-is-a-dataset-lab').then(
        (m) => m.WhatIsADatasetLabPage,
      ),
  },
  {
    path: 'learn/labs/comparing-answers',
    loadComponent: () =>
      import('./pages/comparing-answers-lab/comparing-answers-lab').then(
        (m) => m.ComparingAnswersLabPage,
      ),
  },
  {
    path: 'learn/labs/rubrics-and-criteria',
    loadComponent: () =>
      import('./pages/rubrics-and-criteria-lab/rubrics-and-criteria-lab').then(
        (m) => m.RubricsAndCriteriaLabPage,
      ),
  },
  {
    path: 'learn/labs/train-vs-test',
    loadComponent: () =>
      import('./pages/train-test-lab/train-test-lab').then((m) => m.TrainTestLabPage),
  },
  {
    path: 'learn/labs/loss-and-updates',
    loadComponent: () =>
      import('./pages/loss-updates-lab/loss-updates-lab').then((m) => m.LossUpdatesLabPage),
  },
  {
    path: 'learn/labs/bias-and-weights',
    loadComponent: () =>
      import('./pages/bias-weights-lab/bias-weights-lab').then((m) => m.BiasWeightsLabPage),
  },
  {
    path: 'learn/labs/activation-functions',
    loadComponent: () =>
      import('./pages/activation-functions-lab/activation-functions-lab').then(
        (m) => m.ActivationFunctionsLabPage,
      ),
  },
  {
    path: 'learn/labs/learning-rate',
    loadComponent: () =>
      import('./pages/learning-rate-lab/learning-rate-lab').then((m) => m.LearningRateLabPage),
  },
  {
    path: 'learn/labs/softmax',
    loadComponent: () =>
      import('./pages/softmax-lab/softmax-lab').then((m) => m.SoftmaxLabPage),
  },
  {
    path: 'learn/labs/decision-trees',
    loadComponent: () =>
      import('./pages/decision-trees-lab/decision-trees-lab').then((m) => m.DecisionTreesLabPage),
  },
  {
    path: 'learn/labs/reinforcement-learning',
    loadComponent: () =>
      import('./pages/reinforcement-learning-lab/reinforcement-learning-lab').then(
        (m) => m.ReinforcementLearningLabPage,
      ),
  },

  {
    path: 'learn/labs/controlling-generation',
    loadComponent: () =>
      import('./pages/controlling-generation-lab/controlling-generation-lab').then(
        (m) => m.ControllingGenerationLabPage,
      ),
  },
  {
    path: 'learn/labs/judge-json',
    loadComponent: () =>
      import('./pages/judge-json-lab/judge-json-lab').then((m) => m.JudgeJsonLabPage),
  },
  {
    path: 'learn/labs/faithfulness',
    loadComponent: () =>
      import('./pages/faithfulness-lab/faithfulness-lab').then((m) => m.FaithfulnessLabPage),
  },
  {
    path: 'learn/labs/semantic-memory',
    loadComponent: () =>
      import('./pages/semantic-memory-lab/semantic-memory-lab').then(
        (m) => m.SemanticMemoryLabPage,
      ),
  },
  {
    path: 'learn/labs/multimodal-vector-databases',
    loadComponent: () =>
      import('./pages/multimodal-vector-lab/multimodal-vector-lab').then(
        (m) => m.MultimodalVectorLabPage,
      ),
  },
  {
    path: 'learn/labs/transformers',
    loadComponent: () =>
      import('./pages/transformers-lab/transformers-lab').then((m) => m.TransformersLabPage),
  },

  {
    path: 'learn/labs/semantic-search',
    loadComponent: () =>
      import('./pages/semantic-search-lab/semantic-search-lab').then(
        (m) => m.SemanticSearchLabPage,
      ),
  },
  {
    path: 'learn/labs/rag-playground',
    loadComponent: () =>
      import('./pages/rag-playground/rag-playground').then((m) => m.RagPlaygroundPage),
  },
  {
    path: 'learn/labs/first-evaluation',
    loadComponent: () =>
      import('./pages/learn-walkthrough-page/learn-walkthrough-page').then(
        (m) => m.LearnWalkthroughPage,
      ),
    data: { lessonId: 'first-evaluation-lab' },
  },
  {
    path: 'learn/labs/support-bot-decision',
    loadComponent: () =>
      import('./pages/learn-walkthrough-page/learn-walkthrough-page').then(
        (m) => m.LearnWalkthroughPage,
      ),
    data: { lessonId: 'support-bot-decision-lab' },
  },
  { path: 'learn/neural-network', redirectTo: 'learn/labs/neural-network', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
