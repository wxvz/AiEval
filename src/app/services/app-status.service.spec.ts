import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AppStatus } from '../models/app-status.model';
import { AppStatusService, DEFAULT_ANSWER_SLOT_COUNT } from './app-status.service';

describe('AppStatusService', () => {
  let service: AppStatusService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AppStatusService],
    });
    service = TestBed.inject(AppStatusService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('defaults answerModelCount before status loads', () => {
    expect(service.answerModelCount()).toBe(DEFAULT_ANSWER_SLOT_COUNT);
  });

  it('loads status and exposes activeProvider answerModelCount', async () => {
    const pending = service.load();
    const req = httpMock.expectOne('/api/status');
    const body: AppStatus = {
      mongo: { ok: true, dbName: 'aieval' },
      providers: [],
      activeProvider: {
        name: 'groq',
        answerModels: ['a', 'b'],
        judgeModel: 'judge',
      },
    };
    req.flush(body);
    await pending;

    expect(service.status()).toEqual(body);
    expect(service.answerModelCount()).toBe(2);
  });

  it('falls back to default when activeProvider is null', async () => {
    const pending = service.load();
    httpMock.expectOne('/api/status').flush({
      mongo: { ok: true, dbName: 'aieval' },
      providers: [],
      activeProvider: null,
    } satisfies AppStatus);
    await pending;

    expect(service.answerModelCount()).toBe(DEFAULT_ANSWER_SLOT_COUNT);
  });
});
