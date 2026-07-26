import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App, isLearnAppPath } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render navbar and router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-navbar')).toBeTruthy();
    expect(compiled.querySelector('app-settings-aside')).toBeTruthy();
    expect(compiled.querySelector('app-status-alert')).toBeTruthy();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});

describe('isLearnAppPath', () => {
  it('keeps hub track fragment URLs as learn routes', () => {
    expect(isLearnAppPath('/learn')).toBe(true);
    expect(isLearnAppPath('/learn#track-foundation')).toBe(true);
    expect(isLearnAppPath('/learn#track-llm-systems')).toBe(true);
    expect(isLearnAppPath('/learn?from=nav')).toBe(true);
    expect(isLearnAppPath('/learn/lessons/learning-from-examples')).toBe(true);
    expect(isLearnAppPath('/evaluations')).toBe(false);
  });
});
