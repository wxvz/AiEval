import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnChatFab } from './learn-chat-fab';

describe('LearnChatFab', () => {
  let fixture: ComponentFixture<LearnChatFab>;
  let http: HttpTestingController;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LearnChatFab],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LearnChatFab);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('opens the panel and sends a message to the learn chat API', async () => {
    const el: HTMLElement = fixture.nativeElement;
    const toggle = el.querySelector('.learn-chat-fab__toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(el.querySelector('.learn-chat-fab__panel')).toBeTruthy();

    const component = fixture.componentInstance;
    component.draft = 'What is supervised learning?';
    const pending = component.send();

    const req = http.expectOne('/api/learn-chat');
    req.flush({
      reply: 'Learning from **labeled** examples.',
      sessionId: 's1',
      sources: [],
    });
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
});
