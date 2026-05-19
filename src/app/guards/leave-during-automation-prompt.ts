export const CONFIRM_LEAVE_DURING_AUTOMATION_MODAL_ID = 'confirmLeaveDuringAutomationModal';

/**
 * Ensures repeated navigation attempts while automation is running share one
 * pending Promise until the leave modal is confirmed or dismissed.
 */
export class LeaveDuringAutomationPrompt {
  private pendingPromise: Promise<boolean> | null = null;
  private pendingResolve: ((allow: boolean) => void) | null = null;

  prompt(modalId = CONFIRM_LEAVE_DURING_AUTOMATION_MODAL_ID): Promise<boolean> {
    if (this.pendingPromise) {
      return this.pendingPromise;
    }

    this.pendingPromise = new Promise((resolve) => {
      this.pendingResolve = resolve;
      const modalElement = document.getElementById(modalId);

      if (modalElement) {
        bootstrap.Modal.getOrCreateInstance(modalElement).show();
      } else {
        this.finish(false);
      }
    });

    return this.pendingPromise;
  }

  confirmLeave(): void {
    this.finish(true);
  }

  cancelLeave(): void {
    this.finish(false);
  }

  private finish(allow: boolean): void {
    this.pendingResolve?.(allow);
    this.pendingResolve = null;
    this.pendingPromise = null;
  }
}
