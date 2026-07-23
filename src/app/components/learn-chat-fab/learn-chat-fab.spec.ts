import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LearnChatService,
  type LearnChatAskOptions,
  type LearnChatResponse,
} from '../../services/learn-chat.service';
import { LearnChatFab } from './learn-chat-fab';

describe('LearnChatFab', () => {
  let fixture: ComponentFixture<LearnChatFab>;
  let http: HttpTestingController;
  let learnChat: LearnChatService;

  beforeEach(async () => {
    // Guard against leaked fake timers from other suites (paced reveal uses setTimeout).
    vi.useRealTimers();
    sessionStorage.clear();
    localStorage.clear();
    // Keep unit tests fast: skip thinking delay + paced reveal.
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    await TestBed.configureTestingModule({
      imports: [LearnChatFab],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    learnChat = TestBed.inject(LearnChatService);
    // Avoid real HttpClient context sync / fetch SSE in the FAB unit suite (CI flake surface).
    vi.spyOn(learnChat, 'syncContext').mockResolvedValue(undefined);

    fixture = TestBed.createComponent(LearnChatFab);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens the panel and streams a message to the learn chat API', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const toggle = el.querySelector('.learn-chat-fab__toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(el.querySelector('.learn-chat-fab__panel')).toBeTruthy();

    const ask = vi.spyOn(learnChat, 'ask').mockImplementation(
      async (_message: string, options: LearnChatAskOptions = {}): Promise<LearnChatResponse> => {
        options.onToken?.('Learning from **labeled** examples.');
        return {
          reply: 'Learning from **labeled** examples.',
          sessionId: 's1',
          sources: [],
        };
      },
    );

    const component = fixture.componentInstance;
    component.draft = 'What is supervised learning?';
    await component.send();
    fixture.detectChanges();

    expect(ask).toHaveBeenCalledWith(
      'What is supervised learning?',
      expect.objectContaining({ onToken: expect.any(Function) }),
    );
    expect(el.textContent).toContain('What is supervised learning?');
    expect(el.textContent).toContain('Learning from labeled examples.');
    expect(el.textContent).not.toContain('**');
    expect(el.querySelector('.learn-chat-fab__bubble--assistant strong')?.textContent).toBe(
      'labeled',
    );

    const messages = el.querySelector('.learn-chat-fab__messages') as HTMLDivElement;
    expect(messages).toBeTruthy();
    // Autoscroll runs after the reply is painted.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(messages.scrollTop).toBe(messages.scrollHeight);
  });

  it('shows thinking dots while waiting for the first reply tokens', async () => {
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.learn-chat-fab__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    let resolveAsk!: (value: LearnChatResponse) => void;
    vi.spyOn(learnChat, 'ask').mockImplementation(
      (_message, options) =>
        new Promise<LearnChatResponse>((resolve) => {
          resolveAsk = (value) => {
            options?.onToken?.(value.reply);
            resolve(value);
          };
        }),
    );

    const component = fixture.componentInstance;
    component.draft = 'Explain bias';
    const pending = component.send();
    fixture.detectChanges();

    expect(component.thinking()).toBe(true);
    expect(el.querySelector('.learn-chat-fab__dots')).toBeTruthy();
    expect(el.querySelector('.learn-chat-fab__dots')?.getAttribute('aria-label')).toBe('Thinking');

    resolveAsk({
      reply: 'Bias is a shared baseline.',
      sessionId: 's2',
      sources: [],
    });
    await pending;
    fixture.detectChanges();

    expect(component.thinking()).toBe(false);
    expect(el.querySelector('.learn-chat-fab__dots')).toBeNull();
    expect(el.textContent).toContain('Bias is a shared baseline.');
  });

  it('toggle-dismiss cancels an in-flight ask and drops the empty assistant placeholder', async () => {
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.learn-chat-fab__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    let rejectAsk!: (reason?: unknown) => void;
    const cancel = vi.spyOn(learnChat, 'cancel').mockImplementation(() => {
      rejectAsk?.(new DOMException('Aborted', 'AbortError'));
    });
    vi.spyOn(learnChat, 'ask').mockImplementation(
      () =>
        new Promise<LearnChatResponse>((_resolve, reject) => {
          rejectAsk = reject;
        }),
    );

    const component = fixture.componentInstance;
    component.draft = 'hello';
    const pending = component.send();
    fixture.detectChanges();

    expect(component.sending()).toBe(true);
    expect(component.messages().some((m) => m.role === 'assistant' && !m.text)).toBe(true);

    // Toggle dismiss must abort like close(), not leave fetch/reveal running.
    (el.querySelector('.learn-chat-fab__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(cancel).toHaveBeenCalled();
    expect(component.open()).toBe(false);
    expect(component.sending()).toBe(false);
    expect(component.thinking()).toBe(false);

    await pending;
    fixture.detectChanges();

    expect(component.messages().some((m) => m.role === 'assistant' && !m.text.trim())).toBe(false);
  });

  it('aborted send finally does not clobber a newer in-flight send', async () => {
    const el: HTMLElement = fixture.nativeElement;
    (el.querySelector('.learn-chat-fab__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    let rejectFirst!: (reason?: unknown) => void;
    let resolveSecond!: (value: LearnChatResponse) => void;
    let askCount = 0;
    vi.spyOn(learnChat, 'cancel').mockImplementation(() => {
      if (askCount === 1) {
        rejectFirst?.(new DOMException('Aborted', 'AbortError'));
      }
    });
    vi.spyOn(learnChat, 'ask').mockImplementation((_message, options) => {
      askCount += 1;
      if (askCount === 1) {
        return new Promise<LearnChatResponse>((_resolve, reject) => {
          rejectFirst = reject;
        });
      }
      return new Promise<LearnChatResponse>((resolve) => {
        resolveSecond = (value) => {
          options?.onToken?.(value.reply);
          resolve(value);
        };
      });
    });

    const component = fixture.componentInstance;
    component.draft = 'first';
    const firstPending = component.send();
    fixture.detectChanges();
    expect(component.sending()).toBe(true);

    // Abort the first turn, then start a second send before the first settles.
    component.close();
    (el.querySelector('.learn-chat-fab__toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    component.draft = 'second';
    const secondPending = component.send();
    fixture.detectChanges();
    expect(component.sending()).toBe(true);
    expect(component.messages().filter((m) => m.role === 'user').map((m) => m.text)).toEqual([
      'first',
      'second',
    ]);

    await firstPending;
    fixture.detectChanges();

    // Stale finally must not clear the newer send's busy state.
    expect(component.sending()).toBe(true);
    expect(component.thinking()).toBe(true);

    resolveSecond({
      reply: 'Second reply.',
      sessionId: 's3',
      sources: [],
    });
    await secondPending;
    fixture.detectChanges();

    expect(component.sending()).toBe(false);
    expect(el.textContent).toContain('Second reply.');
  });
});
