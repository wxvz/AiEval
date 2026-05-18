import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-delete-modal',
  imports: [],
  templateUrl: './confirm-delete-modal.html',
  styleUrl: './confirm-delete-modal.css',
})
export class ConfirmDeleteModal {
  readonly modalId = input.required<string>();
  readonly title = input('Confirm delete');
  readonly message = input('Are you sure you want to delete this item?');
  readonly confirmLabel = input('Delete');
  readonly confirmClass = input('btn-danger');
  readonly cancelLabel = input('Cancel');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  onConfirm(): void {
    this.confirmed.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
