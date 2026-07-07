import { Component, computed, input, output } from '@angular/core';

import { parseLessonText } from '../../learn/parse-lesson-text';
import { LearnTermHint } from '../learn-term-hint/learn-term-hint';

@Component({
  selector: 'app-learn-lesson-text',
  imports: [LearnTermHint],
  templateUrl: './learn-lesson-text.html',
  styleUrl: './learn-lesson-text.css',
})
export class LearnLessonText {
  readonly text = input.required<string>();
  readonly hintIdPrefix = input('');
  readonly activeId = input<string | null>(null);
  readonly activeIdChange = output<string | null>();

  readonly segments = computed(() => parseLessonText(this.text()));

  hintId(term: string, index: number): string {
    const prefix = this.hintIdPrefix();
    return prefix ? `${prefix}-${term}-${index}` : `${term}-${index}`;
  }
}
