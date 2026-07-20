import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';

import { LearnChatService, type LearnChatSource } from '../../services/learn-chat.service';
import { LearnLessonText } from '../learn-lesson-text/learn-lesson-text';

export interface LearnChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: LearnChatSource[];
}

@Component({
  selector: 'app-learn-chat-fab',
  imports: [FormsModule, RouterLink, LearnLessonText],
  templateUrl: './learn-chat-fab.html',
  styleUrl: './learn-chat-fab.css',
})
export class LearnChatFab {
  private readonly learnChat = inject(LearnChatService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly draftInput = viewChild<ElementRef<HTMLTextAreaElement>>('draftInput');
  private readonly messageList = viewChild<ElementRef<HTMLDivElement>>('messageList');

  readonly open = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly messages = signal<LearnChatMessage[]>([]);
  draft = '';

  constructor() {
    void this.learnChat.syncContext();

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        void this.learnChat.syncContext();
      });
  }

  toggle(): void {
    this.open.update((value) => !value);
    this.error.set(null);
    if (this.open()) {
      void this.learnChat.syncContext();
      queueMicrotask(() => {
        this.draftInput()?.nativeElement.focus();
        this.scrollToBottom();
      });
    }
  }

  close(): void {
    this.open.set(false);
    this.learnChat.cancel();
    this.sending.set(false);
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    if (!text || this.sending()) {
      return;
    }

    this.draft = '';
    this.error.set(null);
    this.messages.update((list) => [...list, { role: 'user', text }]);
    this.sending.set(true);
    this.scrollToBottom();

    try {
      const response = await this.learnChat.ask(text);
      this.messages.update((list) => [
        ...list,
        {
          role: 'assistant',
          text: response.reply,
          sources: response.sources,
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not reach the tutor. Try again.';
      if (message !== 'Request cancelled.') {
        this.error.set(message);
      }
    } finally {
      this.sending.set(false);
      this.scrollToBottom();
      if (this.open()) {
        queueMicrotask(() => this.draftInput()?.nativeElement.focus());
      }
    }
  }

  /** Keep the latest message (or status) in view after DOM updates. */
  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messageList()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.send();
    }
  }
}
