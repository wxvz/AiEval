import { Injectable, signal } from '@angular/core';

export type FeedbackType = 'success' | 'danger';

export interface FeedbackMessage {
  type: FeedbackType;
  message: string;
}

const AUTO_DISMISS_MS = 5000;
const EXIT_ANIMATION_MS = 250;

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  private readonly feedbackSignal = signal<FeedbackMessage | null>(null);
  private readonly exitingSignal = signal(false);
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;
  private exitTimer: ReturnType<typeof setTimeout> | null = null;

  readonly feedback = this.feedbackSignal.asReadonly();
  readonly exiting = this.exitingSignal.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('danger', message);
  }

  clear(): void {
    this.clearDismissTimer();
    this.clearExitTimer();
    this.exitingSignal.set(false);
    this.feedbackSignal.set(null);
  }

  private show(type: FeedbackType, message: string): void {
    this.clearDismissTimer();
    this.clearExitTimer();
    this.exitingSignal.set(false);
    this.feedbackSignal.set({ type, message });
    this.dismissTimer = setTimeout(() => this.beginDismiss(), AUTO_DISMISS_MS);
  }

  private beginDismiss(): void {
    if (!this.feedbackSignal()) {
      return;
    }

    this.dismissTimer = null;
    this.exitingSignal.set(true);
    this.exitTimer = setTimeout(() => this.clear(), EXIT_ANIMATION_MS);
  }

  private clearDismissTimer(): void {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }

  private clearExitTimer(): void {
    if (this.exitTimer !== null) {
      clearTimeout(this.exitTimer);
      this.exitTimer = null;
    }
  }
}
