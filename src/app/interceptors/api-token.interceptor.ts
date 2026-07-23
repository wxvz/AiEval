import { HttpInterceptorFn } from '@angular/common/http';

import { readStoredApiToken } from '../services/api-token.storage';

/** Attaches Bearer token to `/api/` requests when one is stored in localStorage. */
export const apiTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/')) {
    return next(req);
  }

  if (req.headers.has('Authorization')) {
    return next(req);
  }

  const token = readStoredApiToken();

  if (!token) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    }),
  );
};
