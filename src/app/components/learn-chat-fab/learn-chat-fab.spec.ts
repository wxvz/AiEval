import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LearnChatFab } from './learn-chat-fab';

describe('LearnChatFab', () => {
  let fixture: ComponentFixture<LearnChatFab>;
  let http: HttpTestingController;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    sessionStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
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

    fixture = TestBed.createComponent(LearnChatFab);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  it('opens the panel and streams a message to the learn chat API', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const toggle = el.querySelector('.learn-chat-fab__toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(el.querySelector('.learn-chat-fab__panel')).toBeTruthy();

    fetchMock.mockResolvedValue(
      new Response(
        [
          'event: token\ndata: {"text":"Learning from **labeled** examples."}\n\n',
          'event: done\ndata: {"reply":"Learning from **labeled** examples.","sessionId":"s1","sources":[]}\n\n',
        ].join(''),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      ),
    );

    const component = fixture.componentInstance;
    component.draft = 'What is supervised learning?';
    const pending = component.send();
    await pending;
    fixture.detectChanges();

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

    let resolveFetch!: (value: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const component = fixture.componentInstance;
    component.draft = 'Explain bias';
    const pending = component.send();
    fixture.detectChanges();

    expect(component.thinking()).toBe(true);
    expect(el.querySelector('.learn-chat-fab__dots')).toBeTruthy();
    expect(el.querySelector('.learn-chat-fab__dots')?.getAttribute('aria-label')).toBe('Thinking');

    resolveFetch(
      new Response(
        [
          'event: token\ndata: {"text":"Bias is a shared baseline."}\n\n',
          'event: done\ndata: {"reply":"Bias is a shared baseline.","sessionId":"s2","sources":[]}\n\n',
        ].join(''),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      ),
    );
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

    let rejectFetch!: (reason?: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((_resolve, reject) => {
        rejectFetch = reject;
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

    expect(component.open()).toBe(false);
    expect(component.sending()).toBe(false);
    expect(component.thinking()).toBe(false);

    rejectFetch(new DOMException('Aborted', 'AbortError'));
    await pending;
    fixture.detectChanges();

    expect(component.messages().some((m) => m.role === 'assistant' && !m.text.trim())).toBe(false);
  });
});
