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

/** Minimum thinking-dots beat before the first character reveals (ChatGPT/Claude-like). */
const MIN_THINKING_MS_LO = 300;
const MIN_THINKING_MS_HI = 500;

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
  /** True while the assistant bubble shows dots (before first visible character). */
  readonly thinking = signal(false);
  /** True while paced text reveal is still draining. */
  readonly revealing = signal(false);
  readonly error = signal<string | null>(null);
  readonly messages = signal<LearnChatMessage[]>([]);
  draft = '';

  private revealBuffer = '';
  private revealAbort = false;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private sleepResolve: (() => void) | null = null;

  constructor() {
    void this.learnChat.syncContext();

    this.destroyRef.onDestroy(() => this.abortInflight());

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        // Cancel in-flight ask/sync and stop reveal before syncing the new page.
        this.abortInflight();
        void this.learnChat.syncContext();
      });
  }

  toggle(): void {
    if (this.open()) {
      this.close();
      return;
    }
    this.open.set(true);
    this.error.set(null);
    void this.learnChat.syncContext();
    queueMicrotask(() => {
      this.draftInput()?.nativeElement.focus();
      this.scrollToBottom();
    });
  }

  close(): void {
    this.open.set(false);
    this.abortInflight();
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    if (!text || this.sending()) {
      return;
    }

    this.draft = '';
    this.error.set(null);
    this.messages.update((list) => [
      ...list,
      { role: 'user', text },
      { role: 'assistant', text: '', sources: [] },
    ]);
    this.sending.set(true);
    this.thinking.set(true);
    this.revealing.set(false);
    this.revealAbort = false;
    this.revealBuffer = '';
    this.scrollToBottom();

    const reducedMotion = this.prefersReducedMotion();
    const thinkingStartedAt = Date.now();
    const minThinkingMs = reducedMotion
      ? 0
      : MIN_THINKING_MS_LO +
        Math.floor(Math.random() * (MIN_THINKING_MS_HI - MIN_THINKING_MS_LO + 1));

    let streamDone = false;
    const revealPromise = this.runRevealLoop(thinkingStartedAt, minThinkingMs, () => streamDone);

    try {
      const response = await this.learnChat.ask(text, {
        onToken: (token) => {
          if (this.revealAbort) {
            return;
          }
          if (reducedMotion) {
            this.appendAssistantText(token);
            this.thinking.set(false);
            return;
          }
          this.revealBuffer += token;
        },
      });
      streamDone = true;
      await revealPromise;

      // Close/toggle/nav/destroy may abort after ask resolves; never snap a cancelled reveal.
      if (this.revealAbort) {
        this.dropEmptyAssistantPlaceholder();
        return;
      }

      this.messages.update((list) => {
        if (list.length === 0) {
          return list;
        }
        const copy = list.slice();
        const last = copy[copy.length - 1]!;
        if (last.role !== 'assistant') {
          return [
            ...copy,
            { role: 'assistant', text: response.reply, sources: response.sources },
          ];
        }
        // Snap to the canonical reply (handles any pacing truncation) and attach sources.
        copy[copy.length - 1] = {
          role: 'assistant',
          text: response.reply,
          sources: response.sources,
        };
        return copy;
      });
    } catch (error) {
      streamDone = true;
      this.stopReveal();
      const message =
        error instanceof Error ? error.message : 'Could not reach the tutor. Try again.';
      this.dropEmptyAssistantPlaceholder();
      if (message !== 'Request cancelled.') {
        this.error.set(message);
      }
    } finally {
      this.sending.set(false);
      this.thinking.set(false);
      this.revealing.set(false);
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

  private prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private appendAssistantText(token: string): void {
    this.messages.update((list) => {
      if (list.length === 0) {
        return list;
      }
      const copy = list.slice();
      const last = copy[copy.length - 1]!;
      if (last.role !== 'assistant') {
        return list;
      }
      copy[copy.length - 1] = { ...last, text: last.text + token };
      return copy;
    });
    this.scrollToBottom();
  }

  /** Cancel fetch/SSE and freeze reveal; shared by close, toggle dismiss, nav, destroy. */
  private abortInflight(): void {
    this.learnChat.cancel();
    this.stopReveal();
    this.sending.set(false);
    this.thinking.set(false);
    this.revealing.set(false);
  }

  private dropEmptyAssistantPlaceholder(): void {
    this.messages.update((list) => {
      if (list.length === 0) {
        return list;
      }
      const last = list[list.length - 1]!;
      if (last.role === 'assistant' && !last.text.trim()) {
        return list.slice(0, -1);
      }
      return list;
    });
  }

  private stopReveal(): void {
    this.revealAbort = true;
    this.revealBuffer = '';
    if (this.revealTimer != null) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
    const resolve = this.sleepResolve;
    this.sleepResolve = null;
    resolve?.();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.revealAbort) {
        resolve();
        return;
      }
      this.sleepResolve = resolve;
      this.revealTimer = setTimeout(() => {
        this.revealTimer = null;
        this.sleepResolve = null;
        resolve();
      }, ms);
    });
  }

  /**
   * Hold the thinking dots for minThinkingMs, then drain revealBuffer at a paced rate
   * so the reply feels streamed even when SSE arrives in one burst.
   */
  private async runRevealLoop(
    thinkingStartedAt: number,
    minThinkingMs: number,
    isStreamDone: () => boolean,
  ): Promise<void> {
    if (this.prefersReducedMotion()) {
      return;
    }

    const remaining = minThinkingMs - (Date.now() - thinkingStartedAt);
    if (remaining > 0 && !this.revealAbort) {
      await this.sleep(remaining);
    }

    if (this.revealAbort) {
      return;
    }

    // Stay on dots until the first buffered token (or stream ends empty).
    while (!this.revealAbort && this.revealBuffer.length === 0 && !isStreamDone()) {
      await this.sleep(16);
    }

    if (this.revealAbort) {
      return;
    }

    this.thinking.set(false);
    if (this.revealBuffer.length > 0) {
      this.revealing.set(true);
    }

    while (!this.revealAbort && (this.revealBuffer.length > 0 || !isStreamDone())) {
      if (this.revealBuffer.length === 0) {
        await this.sleep(16);
        continue;
      }
      const chunk = takeRevealChunk(this.revealBuffer);
      this.revealBuffer = this.revealBuffer.slice(chunk.length);
      this.appendAssistantText(chunk);
      await this.sleep(revealDelayMs(this.revealBuffer.length));
    }

    this.revealing.set(false);
  }
}

/** Adaptive chunk size so long replies do not linger forever. */
function takeRevealChunk(buffer: string): string {
  const target = buffer.length > 400 ? 12 : buffer.length > 150 ? 6 : 3;
  const word = /^(\S+\s*)/.exec(buffer);
  if (word && word[1]!.length <= target + 4) {
    return word[1]!;
  }
  return buffer.slice(0, Math.min(target, buffer.length));
}

function revealDelayMs(bufferLen: number): number {
  if (bufferLen > 400) {
    return 8;
  }
  if (bufferLen > 150) {
    return 12;
  }
  return 20;
}
