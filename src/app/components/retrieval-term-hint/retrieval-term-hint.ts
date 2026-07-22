import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

import {
  RETRIEVAL_GLOSSARY,
  type RetrievalGlossaryTerm,
} from '../../utils/retrieval/retrieval-glossary';

@Component({
  selector: 'app-retrieval-term-hint',
  imports: [],
  templateUrl: './retrieval-term-hint.html',
  styleUrl: './retrieval-term-hint.css',
})
export class RetrievalTermHint {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly term = input.required<RetrievalGlossaryTerm>();
  readonly hintId = input<string>();
  readonly activeId = input<string | null>(null);
  readonly activeIdChange = output<string | null>();

  readonly resolvedId = computed(() => this.hintId() ?? this.term());
  readonly entry = computed(() => RETRIEVAL_GLOSSARY[this.term()]);
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
