import { provideHttpClient } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { EvaluationService } from './services/evaluation.service';

function loadEvaluations(): () => Promise<void> {
  const evaluationService = inject(EvaluationService);
  return () => evaluationService.loadFromApi();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    {
      provide: APP_INITIALIZER,
      useFactory: loadEvaluations,
      multi: true,
    },
  ],
};
