import { Component, effect, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-improved-answer-editor',
  imports: [ReactiveFormsModule],
  templateUrl: './improved-answer-editor.html',
  styleUrl: './improved-answer-editor.css',
})
export class ImprovedAnswerEditor {
  readonly value = input('');

  readonly saved = output<string>();

  readonly content = new FormControl('', { nonNullable: true });

  constructor() {
    effect(() => {
      this.content.setValue(this.value());
    });
  }

  onSave(): void {
    this.saved.emit(this.content.value.trim());
  }
}
