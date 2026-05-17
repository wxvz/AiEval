import { Injectable, signal } from '@angular/core';

export type FeedbackType = 'success' | 'danger';

export interface FeedbackMessage {
  type: FeedbackType;
  message: string;
}

const AUTO_DISMISS_MS = 5000;

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  private readonly feedbackSignal = signal<FeedbackMessage | null>(null);
  private dismissTimer: ReturnType<typeof setTimeout> | null = null;

  readonly feedback = this.feedbackSignal.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('danger', message);
  }

  clear(): void {
    this.clearDismissTimer();
    this.feedbackSignal.set(null);
  }

  private show(type: FeedbackType, message: string): void {
    this.clearDismissTimer();
    this.feedbackSignal.set({ type, message });
    this.dismissTimer = setTimeout(() => this.clear(), AUTO_DISMISS_MS);
  }

  private clearDismissTimer(): void {
    if (this.dismissTimer !== null) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  }
}
