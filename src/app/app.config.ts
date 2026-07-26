import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { apiTokenInterceptor } from './interceptors/api-token.interceptor';
import { routes } from './app.routes';
import { AppStatusService } from './services/app-status.service';
import { EvaluationService } from './services/evaluation.service';

function loadAppData(): () => Promise<void> {
  const evaluationService = inject(EvaluationService);
  const appStatus = inject(AppStatusService);
  return async () => {
    await Promise.all([evaluationService.loadFromApi(), appStatus.load()]);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    provideHttpClient(withInterceptors([apiTokenInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: loadAppData,
      multi: true,
    },
  ],
};
