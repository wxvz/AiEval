import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { PageShell } from '../../components/page-shell/page-shell';
import { RetrievalTermHint } from '../../components/retrieval-term-hint/retrieval-term-hint';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { rankByQuery } from '../../utils/retrieval/similarity';

const PRESET_QUERIES = [
  'evaluation rubric',
  'semantic search retrieval',
  'neural network training',
  'RAG context window',
];

@Component({
  selector: 'app-semantic-memory-lab',
  imports: [FormsModule, DecimalPipe, RouterLink, RetrievalTermHint, LearnLabNav, PageShell],
  templateUrl: './semantic-memory-lab.html',
  styleUrl: './semantic-memory-lab.css',
})
export class SemanticMemoryLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('semantic-memory-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly presetQueries = PRESET_QUERIES;

  readonly query = signal('evaluation rubric');
  readonly topK = signal(3);
  readonly openTermId = signal<string | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('semantic-memory-lab');
  });

  readonly rankings = computed(() => rankByQuery(this.query(), this.topK()));

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  usePreset(preset: string): void {
    this.query.set(preset);
  }

  markLabComplete(): void {
    this.progress.markComplete('semantic-memory-lab');
  }
}
