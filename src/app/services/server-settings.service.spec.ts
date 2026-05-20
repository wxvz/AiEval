import { HttpClient } from '@angular/common/http';
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
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ServerSettingsService);
    httpMock = TestBed.inject(HttpTestingController);
    feedback = TestBed.inject(FeedbackService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads settings from GET /api/settings', async () => {
    const loadPromise = service.load();

    const req = httpMock.expectOne('/api/settings');
    expect(req.request.method).toBe('GET');
    req.flush({ llmPreset: 'balanced', envDefaultLlmPreset: 'fast' });

    await loadPromise;

    expect(service.llmPreset()).toBe('balanced');
    expect(service.envDefaultLlmPreset()).toBe('fast');
    expect(service.error()).toBeNull();
  });

  it('reverts preset on PATCH failure', async () => {
    const loadPromise = service.load();
    httpMock.expectOne('/api/settings').flush({
      llmPreset: 'balanced',
      envDefaultLlmPreset: 'balanced',
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
    });
    await loadPromise;

    const resetPromise = service.resetToEnvDefault();
    const patchReq = httpMock.expectOne('/api/settings');
    expect(patchReq.request.body).toEqual({ llmPreset: 'fast' });
    patchReq.flush({ llmPreset: 'fast', envDefaultLlmPreset: 'fast' });

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
