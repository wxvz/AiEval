import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
} from '@angular/core';

import { LEARN_GLOSSARY, type LearnGlossaryTerm } from '../../learn/learn-glossary';

@Component({
  selector: 'app-learn-term-hint',
  imports: [],
  templateUrl: './learn-term-hint.html',
  styleUrl: './learn-term-hint.css',
})
export class LearnTermHint {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly term = input.required<LearnGlossaryTerm>();
  readonly hintId = input<string>();
  readonly activeId = input<string | null>(null);
  readonly activeIdChange = output<string | null>();

  readonly resolvedId = computed(() => this.hintId() ?? this.term());
  readonly entry = computed(() => LEARN_GLOSSARY[this.term()]);
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
