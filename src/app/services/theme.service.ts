import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'aieval-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.readInitialTheme());
  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((event: MediaQueryListEvent) => void) | null = null;

  constructor() {
    this.applyResolved(this.resolveTheme(this.theme()));
    this.syncSystemListener(this.theme());
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    this.syncSystemListener(theme);
    this.applyResolved(this.resolveTheme(theme));
  }

  resetTheme(): void {
    localStorage.removeItem(STORAGE_KEY);
    const theme = this.readInitialTheme();
    this.theme.set(theme);
    this.syncSystemListener(theme);
    this.applyResolved(this.resolveTheme(theme));
  }

  resolveTheme(theme: Theme): ResolvedTheme {
    if (theme === 'system') {
      return this.systemPrefersDark() ? 'dark' : 'light';
    }

    return theme;
  }

  private readInitialTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }

    return 'system';
  }

  private systemPrefersDark(): boolean {
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    return false;
  }

  private syncSystemListener(theme: Theme): void {
    if (typeof window.matchMedia !== 'function') {
      return;
    }

    if (theme !== 'system') {
      this.detachSystemListener();
      return;
    }

    if (!this.mediaQuery) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaListener = () => {
        if (this.theme() === 'system') {
          this.applyResolved(this.resolveTheme('system'));
        }
      };
      this.mediaQuery.addEventListener('change', this.mediaListener);
    }
  }

  private detachSystemListener(): void {
    if (this.mediaQuery && this.mediaListener) {
      this.mediaQuery.removeEventListener('change', this.mediaListener);
    }

    this.mediaQuery = null;
    this.mediaListener = null;
  }

  private applyResolved(resolved: ResolvedTheme): void {
    document.documentElement.setAttribute('data-bs-theme', resolved);
  }
}
