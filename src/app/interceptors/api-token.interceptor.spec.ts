import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { API_TOKEN_STORAGE_KEY } from '../services/api-token.storage';
import { apiTokenInterceptor } from './api-token.interceptor';

describe('apiTokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiTokenInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('adds Authorization Bearer when token is stored', async () => {
    localStorage.setItem(API_TOKEN_STORAGE_KEY, 'my-secret');

    const promise = firstValueFrom(http.get('/api/evaluations'));
    const req = httpMock.expectOne('/api/evaluations');

    expect(req.request.headers.get('Authorization')).toBe('Bearer my-secret');
    req.flush([]);
    await promise;
  });

  it('does not add Authorization when no token is stored', async () => {
    const promise = firstValueFrom(http.get('/api/status'));
    const req = httpMock.expectOne('/api/status');

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await promise;
  });

  it('does not modify non-api requests', async () => {
    localStorage.setItem(API_TOKEN_STORAGE_KEY, 'my-secret');

    const promise = firstValueFrom(http.get('/assets/x.json'));
    const req = httpMock.expectOne('/assets/x.json');

    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
    await promise;
  });
});
