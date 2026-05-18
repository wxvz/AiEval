import { Component, input, output, signal } from '@angular/core';

export interface ProviderChoiceDetails {
  currentProvider: string;
  cloudProvider: string | null;
  elapsedLabel: string;
}

@Component({
  selector: 'app-provider-choice-modal',
  imports: [],
  templateUrl: './provider-choice-modal.html',
})
export class ProviderChoiceModal {
  readonly modalId = input.required<string>();
  readonly details = signal<ProviderChoiceDetails | null>(null);

  readonly useCloud = output<void>();
  readonly useLocal = output<void>();

  setDetails(details: ProviderChoiceDetails): void {
    this.details.set(details);
  }

  formatProvider(name: string): string {
    if (name === 'openrouter') {
      return 'OpenRouter';
    }

    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  onUseCloud(): void {
    this.useCloud.emit();
  }

  onUseLocal(): void {
    this.useLocal.emit();
  }
}
