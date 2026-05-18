import { CanDeactivateFn } from '@angular/router';

import { EditEvaluationPage } from '../pages/edit-evaluation-page/edit-evaluation-page';

export const automationCanDeactivateGuard: CanDeactivateFn<EditEvaluationPage> = (component) =>
  component.canDeactivate();
