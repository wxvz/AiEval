import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-empty-state',
  imports: [RouterLink],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
})
export class EmptyState {
  readonly title = input('Nothing here yet');
  readonly message = input('Get started by creating your first evaluation.');
  readonly actionLabel = input<string | undefined>(undefined);
  readonly actionLink = input<string | undefined>(undefined);
}
