import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { SettingsService } from '../../services/settings.service';
import { SettingsAside } from './settings-aside';

describe('SettingsAside refreshStatus', () => {
  let httpMock: HttpTestingController;
  let settingsService: SettingsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsAside],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    settingsService = TestBed.inject(SettingsService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('disables refresh while a status request is in flight', () => {
    const fixture = TestBed.createComponent(SettingsAside);
    const component = fixture.componentInstance;

    settingsService.open();
    fixture.detectChanges();

    const statusReq = httpMock.expectOne('/api/status');
    const settingsReq = httpMock.expectOne('/api/settings');

    expect((component as unknown as { statusRefreshing: () => boolean }).statusRefreshing()).toBe(
      true,
    );

    const compiled = fixture.nativeElement as HTMLElement;
    const refreshButton = compiled.querySelector(
      '#settingsServerHeading',
    )?.parentElement?.querySelector('button');

    expect(refreshButton?.hasAttribute('disabled')).toBe(true);

    statusReq.flush({
      mongo: { ok: true, dbName: 'aieval' },
      providers: [],
      activeProvider: null,
    });
    settingsReq.flush({ llmPreset: 'balanced', envDefaultLlmPreset: 'balanced' });
    fixture.detectChanges();

    expect(refreshButton?.hasAttribute('disabled')).toBe(false);
  });

  it('ignores duplicate refresh clicks while in flight', () => {
    const fixture = TestBed.createComponent(SettingsAside);
    const component = fixture.componentInstance;

    settingsService.open();
    fixture.detectChanges();

    httpMock.expectOne('/api/status');
    httpMock.expectOne('/api/settings');

    (component as unknown as { refreshStatus: () => void }).refreshStatus();

    httpMock.expectNone('/api/status');
  });
});
