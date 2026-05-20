import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('uses stored theme from localStorage', () => {
    localStorage.setItem('aieval-theme', 'dark');

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('defaults to system when nothing is stored', () => {
    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('system');
  });

  it('resolves system theme from matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query.includes('dark'),
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });

    const service = TestBed.inject(ThemeService);

    service.setTheme('system');

    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('resetTheme removes storage and reapplies', () => {
    localStorage.setItem('aieval-theme', 'dark');

    const service = TestBed.inject(ThemeService);

    service.resetTheme();

    expect(localStorage.getItem('aieval-theme')).toBeNull();
    expect(service.theme()).toBe('system');
  });
});
