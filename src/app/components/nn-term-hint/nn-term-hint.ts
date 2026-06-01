import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

import { NN_GLOSSARY, NnGlossaryTerm } from '../../utils/nn/nn-glossary';

@Component({
  selector: 'app-nn-term-hint',
  imports: [],
  templateUrl: './nn-term-hint.html',
  styleUrl: './nn-term-hint.css',
})
export class NnTermHint {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly term = input.required<NnGlossaryTerm>();
  readonly hintId = input<string>();
  readonly activeId = input<string | null>(null);
  readonly activeIdChange = output<string | null>();

  readonly resolvedId = computed(() => this.hintId() ?? this.term());
  readonly entry = computed(() => NN_GLOSSARY[this.term()]);
  readonly isOpen = computed(() => this.activeId() === this.resolvedId());

  toggle(event: Event): void {
    event.stopPropagation();
    this.activeIdChange.emit(this.isOpen() ? null : this.resolvedId());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) {
      return;
    }
    if (this.host.nativeElement.contains(event.target as Node)) {
      return;
    }
    this.activeIdChange.emit(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.activeIdChange.emit(null);
    }
  }
}
