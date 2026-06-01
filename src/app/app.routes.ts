import { Routes } from '@angular/router';

import { automationCanDeactivateGuard } from './guards/automation-can-deactivate.guard';
import { AboutPage } from './pages/about-page/about-page';
import { CompareAnswersPage } from './pages/compare-answers-page/compare-answers-page';
import { CreateEvaluationPage } from './pages/create-evaluation-page/create-evaluation-page';
import { DashboardPage } from './pages/dashboard-page/dashboard-page';
import { EditEvaluationPage } from './pages/edit-evaluation-page/edit-evaluation-page';
import { ImprovedAnswerPage } from './pages/improved-answer-page/improved-answer-page';
import { LearnPage } from './pages/learn-page/learn-page';
import { NnPlaygroundPage } from './pages/nn-playground/nn-playground';

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
  { path: 'learn/neural-network', component: NnPlaygroundPage },
  { path: '**', redirectTo: '' },
];
