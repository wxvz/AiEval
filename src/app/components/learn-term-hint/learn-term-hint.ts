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
  /** When set, terms are saved to the lesson aside instead of opening inline popovers. */
  readonly savedTerms = input<LearnGlossaryTerm[] | null>(null);
  readonly termSelect = output<LearnGlossaryTerm>();

  readonly resolvedId = computed(() => this.hintId() ?? this.term());
  readonly entry = computed(() => LEARN_GLOSSARY[this.term()]);
  readonly isAsideMode = computed(() => this.savedTerms() !== null);
  readonly isSaved = computed(() => this.savedTerms()?.includes(this.term()) ?? false);
  readonly isPrimaryOccurrence = input(true);
  readonly isInteractive = computed(
    () => !this.isAsideMode() || (!this.isSaved() && this.isPrimaryOccurrence()),
  );
  readonly isOpen = computed(() => this.activeId() === this.resolvedId());

  selectTerm(event: Event): void {
    event.stopPropagation();
    this.termSelect.emit(this.term());
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.activeIdChange.emit(this.isOpen() ? null : this.resolvedId());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isAsideMode() || !this.isOpen()) {
      return;
    }
    if (this.host.nativeElement.contains(event.target as Node)) {
      return;
    }
    this.activeIdChange.emit(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.isAsideMode() && this.isOpen()) {
      this.activeIdChange.emit(null);
    }
  }
}
