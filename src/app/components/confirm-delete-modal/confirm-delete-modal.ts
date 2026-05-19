import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-confirm-delete-modal',
  imports: [],
  templateUrl: './confirm-delete-modal.html',
  styleUrl: './confirm-delete-modal.css',
})
export class ConfirmDeleteModal {
  private readonly destroyRef = inject(DestroyRef);
  private readonly modalRoot = viewChild<ElementRef<HTMLElement>>('modalRoot');

  private confirmedThisShow = false;

  readonly modalId = input.required<string>();
  readonly title = input('Confirm delete');
  readonly message = input('Are you sure you want to delete this item?');
  readonly confirmLabel = input('Delete');
  readonly confirmClass = input('btn-danger');
  readonly cancelLabel = input('Cancel');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  constructor() {
    afterNextRender(() => {
      const element = this.modalRoot()?.nativeElement;

      if (!element) {
        return;
      }

      const onHidden = (): void => {
        if (!this.confirmedThisShow) {
          this.cancelled.emit();
        }

        this.confirmedThisShow = false;
      };

      element.addEventListener('hidden.bs.modal', onHidden);
      this.destroyRef.onDestroy(() => {
        element.removeEventListener('hidden.bs.modal', onHidden);
      });
    });
  }

  onConfirm(): void {
    this.confirmedThisShow = true;
    this.confirmed.emit();
  }
}
