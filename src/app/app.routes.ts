import { Routes } from '@angular/router';

import { automationCanDeactivateGuard } from './guards/automation-can-deactivate.guard';
import { AboutPage } from './pages/about-page/about-page';
import { CompareAnswersPage } from './pages/compare-answers-page/compare-answers-page';
import { CreateEvaluationPage } from './pages/create-evaluation-page/create-evaluation-page';
import { DashboardPage } from './pages/dashboard-page/dashboard-page';
import { EditEvaluationPage } from './pages/edit-evaluation-page/edit-evaluation-page';
import { ImprovedAnswerPage } from './pages/improved-answer-page/improved-answer-page';
import { LearnLessonPage } from './pages/learn-lesson-page/learn-lesson-page';
import { LearnPage } from './pages/learn-page/learn-page';
import { LearnWalkthroughPage } from './pages/learn-walkthrough-page/learn-walkthrough-page';
import { NnPlaygroundPage } from './pages/nn-playground/nn-playground';
import { RagPlaygroundPage } from './pages/rag-playground/rag-playground';
import { SemanticSearchLabPage } from './pages/semantic-search-lab/semantic-search-lab';
import { TrainTestLabPage } from './pages/train-test-lab/train-test-lab';
import { LossUpdatesLabPage } from './pages/loss-updates-lab/loss-updates-lab';

export const routes: Routes = [
  { path: '', component: DashboardPage },
  {
    path: 'evaluations/new',
    component: CreateEvaluationPage,
    canDeactivate: [automationCanDeactivateGuard],
  },
  {
    path: 'evaluations/:id/edit',
    component: EditEvaluationPage,
    canDeactivate: [automationCanDeactivateGuard],
  },
  {
    path: 'evaluations/:id/compare',
    component: CompareAnswersPage,
    canDeactivate: [automationCanDeactivateGuard],
  },
  {
    path: 'evaluations/:id/improved',
    component: ImprovedAnswerPage,
    canDeactivate: [automationCanDeactivateGuard],
  },
  { path: 'about', component: AboutPage },
  { path: 'learn', component: LearnPage },
  { path: 'learn/lessons/:lessonId', component: LearnLessonPage },
  { path: 'learn/labs/neural-network', component: NnPlaygroundPage },
  { path: 'learn/labs/train-vs-test', component: TrainTestLabPage },
  { path: 'learn/labs/loss-and-updates', component: LossUpdatesLabPage },
  { path: 'learn/labs/semantic-search', component: SemanticSearchLabPage },
  { path: 'learn/labs/rag-playground', component: RagPlaygroundPage },
  { path: 'learn/labs/first-evaluation', component: LearnWalkthroughPage },
  { path: 'learn/neural-network', redirectTo: 'learn/labs/neural-network', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
