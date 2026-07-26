import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SettingsService } from '../../services/settings.service';
import { SettingsAside } from './settings-aside';

const SETTINGS_BODY = {
  llmPreset: 'balanced' as const,
  envDefaultLlmPreset: 'balanced' as const,
  apiTokenRequired: false,
};

const STATUS_BODY = {
  mongo: { ok: true, dbName: 'aieval' },
  providers: [],
  activeProvider: null,
};

/** Prefetch runs on first render via afterNextRender. */
function flushPrefetch(
  httpMock: HttpTestingController,
  body: typeof SETTINGS_BODY = SETTINGS_BODY,
): void {
  httpMock.expectOne('/api/settings').flush(body);
}

/** Settings open loads after Bootstrap fires `shown.bs.offcanvas`. */
function flushOpenShown(fixture: { nativeElement: HTMLElement }): void {
  const panel = fixture.nativeElement.querySelector('.settings-aside');
  panel?.dispatchEvent(new Event('shown.bs.offcanvas'));
}

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

  it('keeps Refresh idle during silent open status load', async () => {
    const fixture = TestBed.createComponent(SettingsAside);
    const component = fixture.componentInstance;

    fixture.detectChanges();
    flushPrefetch(httpMock);
    await fixture.whenStable();

    settingsService.open();
    fixture.detectChanges();
    flushOpenShown(fixture);
    fixture.detectChanges();

    const statusReq = httpMock.expectOne('/api/status');
    httpMock.expectNone('/api/settings');

    expect((component as unknown as { statusRefreshing: () => boolean }).statusRefreshing()).toBe(
      false,
    );

    const compiled = fixture.nativeElement as HTMLElement;
    const refreshButton = compiled.querySelector(
      '#settingsServerHeading',
    )?.parentElement?.querySelector('button');

    expect(refreshButton?.hasAttribute('disabled')).toBe(false);
    expect(refreshButton?.textContent?.trim()).toBe('Refresh');

    statusReq.flush(STATUS_BODY);
    fixture.detectChanges();

    expect(refreshButton?.hasAttribute('disabled')).toBe(false);
  });

  it('queues a user Refresh click that arrives during silent open load', async () => {
    const fixture = TestBed.createComponent(SettingsAside);
    const component = fixture.componentInstance;

    fixture.detectChanges();
    flushPrefetch(httpMock);
    await fixture.whenStable();

    settingsService.open();
    fixture.detectChanges();
    flushOpenShown(fixture);
    fixture.detectChanges();

    const silentStatus = httpMock.expectOne('/api/status');
    httpMock.expectNone('/api/settings');

    (component as unknown as { refreshStatus: (showToast?: boolean) => void }).refreshStatus(true);
    fixture.detectChanges();

    expect((component as unknown as { statusRefreshing: () => boolean }).statusRefreshing()).toBe(
      true,
    );

    silentStatus.flush(STATUS_BODY);
    fixture.detectChanges();

    const userStatus = httpMock.expectOne('/api/status');
    expect((component as unknown as { statusRefreshing: () => boolean }).statusRefreshing()).toBe(
      true,
    );

    userStatus.flush(STATUS_BODY);
    fixture.detectChanges();

    expect((component as unknown as { statusRefreshing: () => boolean }).statusRefreshing()).toBe(
      false,
    );
  });

  it('disables refresh while a user-initiated status request is in flight', async () => {
    const fixture = TestBed.createComponent(SettingsAside);
    const component = fixture.componentInstance;

    fixture.detectChanges();
    flushPrefetch(httpMock);
    await fixture.whenStable();

    settingsService.open();
    fixture.detectChanges();
    flushOpenShown(fixture);
    fixture.detectChanges();

    httpMock.expectOne('/api/status').flush(STATUS_BODY);
    httpMock.expectNone('/api/settings');
    fixture.detectChanges();

    (component as unknown as { refreshStatus: (showToast?: boolean) => void }).refreshStatus(true);
    fixture.detectChanges();

    const statusReq = httpMock.expectOne('/api/status');
    expect((component as unknown as { statusRefreshing: () => boolean }).statusRefreshing()).toBe(
      true,
    );

    const compiled = fixture.nativeElement as HTMLElement;
    const refreshButton = compiled.querySelector(
      '#settingsServerHeading',
    )?.parentElement?.querySelector('button');

    expect(refreshButton?.hasAttribute('disabled')).toBe(true);
    expect(refreshButton?.textContent?.trim()).toBe('Refreshing…');

    statusReq.flush(STATUS_BODY);
    fixture.detectChanges();

    expect(refreshButton?.hasAttribute('disabled')).toBe(false);
    expect(refreshButton?.textContent?.trim()).toBe('Refresh');
  });

  it('ignores duplicate silent refresh while in flight', async () => {
    const fixture = TestBed.createComponent(SettingsAside);
    const component = fixture.componentInstance;

    fixture.detectChanges();
    flushPrefetch(httpMock);
    await fixture.whenStable();

    settingsService.open();
    fixture.detectChanges();
    flushOpenShown(fixture);
    fixture.detectChanges();

    const statusReq = httpMock.expectOne('/api/status');
    httpMock.expectNone('/api/settings');

    (component as unknown as { refreshStatus: () => void }).refreshStatus();
    httpMock.expectNone('/api/status');

    statusReq.flush(STATUS_BODY);
  });

  it('loads panel data when already visible without a second shown event', async () => {
    const fixture = TestBed.createComponent(SettingsAside);

    fixture.detectChanges();
    flushPrefetch(httpMock);
    await fixture.whenStable();

    const panel = fixture.nativeElement.querySelector('.settings-aside') as HTMLElement;
    panel.classList.add('show');

    settingsService.open();
    fixture.detectChanges();

    httpMock.expectOne('/api/status').flush(STATUS_BODY);
    httpMock.expectNone('/api/settings');
  });

  it('shows empty-state banner when apiTokenRequired and no stored token', async () => {
    localStorage.removeItem('aieval-api-token');
    const fixture = TestBed.createComponent(SettingsAside);

    fixture.detectChanges();
    flushPrefetch(httpMock, { ...SETTINGS_BODY, apiTokenRequired: true });
    await fixture.whenStable();

    settingsService.open();
    fixture.detectChanges();
    flushOpenShown(fixture);
    fixture.detectChanges();

    httpMock.expectOne('/api/status').flush(STATUS_BODY);
    httpMock.expectNone('/api/settings');
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No API token stored in this browser');
  });
});
