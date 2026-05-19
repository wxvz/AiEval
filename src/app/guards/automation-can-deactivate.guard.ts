import { CanDeactivateFn } from '@angular/router';

export interface AutomationCanDeactivate {
  canDeactivate(): boolean | Promise<boolean>;
}

export const automationCanDeactivateGuard: CanDeactivateFn<AutomationCanDeactivate> = (component) =>
  component.canDeactivate();
