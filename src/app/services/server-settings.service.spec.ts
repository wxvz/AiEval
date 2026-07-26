import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { FeedbackService } from './feedback.service';
import { ServerSettingsService } from './server-settings.service';

describe('ServerSettingsService', () => {
  let service: ServerSettingsService;
  let httpMock: HttpTestingController;
  let feedback: FeedbackService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ServerSettingsService);
    httpMock = TestBed.inject(HttpTestingController);
    feedback = TestBed.inject(FeedbackService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('loads settings from GET /api/settings', async () => {
    const loadPromise = service.load();

    const req = httpMock.expectOne('/api/settings');
    expect(req.request.method).toBe('GET');
    req.flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'fast',
      apiTokenRequired: true,
    });

    await loadPromise;

    expect(service.llmPreset()).toBe('balanced');
    expect(service.envDefaultLlmPreset()).toBe('fast');
    expect(service.apiTokenRequired()).toBe(true);
    expect(service.error()).toBeNull();
  });

  it('soft load refreshes without toggling loading when cached', async () => {
    const first = service.load();
    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await first;
    expect(service.loading()).toBe(false);

    const soft = service.load({ soft: true });
    expect(service.loading()).toBe(false);

    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'fast',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await soft;

    expect(service.llmPreset()).toBe('fast');
    expect(service.loading()).toBe(false);
  });

  it('soft load skips loading flag even without a cached preset', async () => {
    const soft = service.load({ soft: true });
    expect(service.loading()).toBe(false);

    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await soft;

    expect(service.llmPreset()).toBe('balanced');
    expect(service.loading()).toBe(false);
  });

  it('joins concurrent soft loads onto one GET', async () => {
    const first = service.load({ soft: true });
    const second = service.load({ soft: true });

    const req = httpMock.expectOne('/api/settings');
    req.flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });

    await Promise.all([first, second]);
    httpMock.expectNone('/api/settings');
    expect(service.llmPreset()).toBe('balanced');
  });

  it('skipIfCached soft load is a no-op when a preset is already cached', async () => {
    const warm = service.load({ soft: true });
    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await warm;

    await service.load({ soft: true, skipIfCached: true });
    httpMock.expectNone('/api/settings');
    expect(service.llmPreset()).toBe('balanced');
  });

  it('does not let a stale soft load overwrite a newer preset PATCH', async () => {
    const warm = service.load({ soft: true });
    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await warm;

    const stale = service.load({ soft: true });
    const staleReq = httpMock.expectOne('/api/settings');

    const patchPromise = service.setLlmPreset('fast');
    const patchReq = httpMock.expectOne('/api/settings');
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush({
      llmPreset: 'fast',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await patchPromise;
    expect(service.llmPreset()).toBe('fast');

    // Late GET still reports the pre-PATCH value — must not win.
    staleReq.flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await stale;

    expect(service.llmPreset()).toBe('fast');
  });

  it('keeps the newer preset when overlapping PATCHes resolve out of order', async () => {
    const warm = service.load({ soft: true });
    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await warm;

    const first = service.setLlmPreset('fast');
    const second = service.setLlmPreset('balanced');

    const patches = httpMock.match(
      (req) => req.url === '/api/settings' && req.method === 'PATCH',
    );
    expect(patches).toHaveLength(2);
    expect(patches[0].request.body).toEqual({ llmPreset: 'fast' });
    expect(patches[1].request.body).toEqual({ llmPreset: 'balanced' });

    // Older PATCH resolves last — must not overwrite the newer optimistic/server value.
    patches[1].flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await second;
    expect(service.llmPreset()).toBe('balanced');

    patches[0].flush({
      llmPreset: 'fast',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    const firstChanged = await first;
    expect(firstChanged).toBe(false);
    expect(service.llmPreset()).toBe('balanced');
    expect(service.patching()).toBe(false);
  });

  it('getApiToken / setApiToken round-trip via localStorage', () => {
    localStorage.clear();
    expect(service.getApiToken()).toBeNull();

    service.setApiToken('  secret  ');
    expect(service.getApiToken()).toBe('secret');
    expect(localStorage.getItem('aieval-api-token')).toBe('secret');

    service.setApiToken('');
    expect(service.getApiToken()).toBeNull();
    expect(localStorage.getItem('aieval-api-token')).toBeNull();
  });

  it('reverts preset on PATCH failure', async () => {
    const loadPromise = service.load();
    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
      apiTokenRequired: false,
    });
    await loadPromise;

    const patchPromise = service.setLlmPreset('fast');
    const patchReq = httpMock.expectOne('/api/settings');
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({ llmPreset: 'fast' });
    patchReq.flush({ message: 'Server error' }, { status: 500, statusText: 'Error' });

    const changed = await patchPromise;

    expect(changed).toBe(false);
    expect(service.llmPreset()).toBe('balanced');
    expect(feedback.feedback()?.type).toBe('danger');
  });

  it('resetToEnvDefault patches env default preset and returns true', async () => {
    const loadPromise = service.load();
    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'fast',
      apiTokenRequired: false,
    });
    await loadPromise;

    const resetPromise = service.resetToEnvDefault();
    const patchReq = httpMock.expectOne('/api/settings');
    expect(patchReq.request.body).toEqual({ llmPreset: 'fast' });
    patchReq.flush({
      llmPreset: 'fast',
      envDefaultLlmPreset: 'fast',
      apiTokenRequired: false,
    });

    const reset = await resetPromise;

    expect(reset).toBe(true);
    expect(service.llmPreset()).toBe('fast');
    expect(feedback.feedback()).toBeNull();
  });

  it('resetToEnvDefault returns true without PATCH when already at env default', async () => {
    const loadPromise = service.load();
    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'fast',
      envDefaultLlmPreset: 'fast',
      apiTokenRequired: false,
    });
    await loadPromise;

    const reset = await service.resetToEnvDefault();

    expect(reset).toBe(true);
    httpMock.expectNone('/api/settings');
  });

  it('resetToEnvDefault returns false on PATCH failure without showing feedback', async () => {
    const loadPromise = service.load();
    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'fast',
      apiTokenRequired: false,
    });
    await loadPromise;

    const resetPromise = service.resetToEnvDefault();
    const patchReq = httpMock.expectOne('/api/settings');
    patchReq.flush({ message: 'Server error' }, { status: 500, statusText: 'Error' });

    const reset = await resetPromise;

    expect(reset).toBe(false);
    expect(service.llmPreset()).toBe('balanced');
    expect(feedback.feedback()).toBeNull();
  });
});
