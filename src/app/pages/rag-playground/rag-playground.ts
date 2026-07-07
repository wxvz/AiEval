import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RetrievalTermHint } from '../../components/retrieval-term-hint/retrieval-term-hint';
import { getLesson, getLessonsForTrack, getTrack } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { assembleContext, estimateTokens } from '../../utils/retrieval/context';
import { TEACHING_CORPUS } from '../../utils/retrieval/corpus';
import { rankByQuery } from '../../utils/retrieval/similarity';
import { extractiveAnswer } from '../../utils/retrieval/stub-generate';
import { queryToVector } from '../../utils/retrieval/vocabulary';

const DEFAULT_MAX_CHARS = 400;

@Component({
  selector: 'app-rag-playground',
  imports: [FormsModule, RouterLink, RetrievalTermHint, DecimalPipe],
  templateUrl: './rag-playground.html',
  styleUrl: './rag-playground.css',
})
export class RagPlaygroundPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('rag-playground-lab');
  readonly prereqMeta = getLesson(this.labMeta?.prerequisites[0] ?? '');
  readonly trackLabel = getTrack('llm-systems')?.title ?? 'LLM systems';
  readonly trackLabCount = getLessonsForTrack('llm-systems').filter((lesson) => lesson.status === 'live').length;

  readonly query = signal('How does RAG use retrieval?');
  readonly topK = signal(3);
  readonly maxChars = signal(DEFAULT_MAX_CHARS);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly openTermId = signal<string | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('rag-playground-lab');
  });

  readonly rankings = computed(() => rankByQuery(this.query(), this.topK()));

  readonly selectedChunks = computed(() => {
    const selected = this.selectedIds();
    return this.rankings().filter((row) => selected.has(row.chunk.id));
  });

  readonly assembledContext = computed(() =>
    assembleContext(
      this.selectedChunks().map((row) => ({ text: row.chunk.text })),
      this.maxChars(),
    ),
  );

  readonly tokenEstimate = computed(() => estimateTokens(this.assembledContext()));

  readonly promptPreview = computed(() => {
    const context = this.assembledContext();
    const query = this.query().trim();
    if (!context) {
      return `User question: ${query}\n\n(Context empty — select chunks above.)`;
    }
    return `System: Answer using only the context below.\n\nContext:\n${context}\n\nUser: ${query}`;
  });

  readonly stubAnswer = computed(() => extractiveAnswer(this.query(), this.assembledContext()));

  readonly queryVector = computed(() => queryToVector(this.query()));

  readonly plotPoints = computed(() => {
    const queryVec = this.queryVector();
    const rankedIds = new Set(this.rankings().map((row) => row.chunk.id));
    const selected = this.selectedIds();
    return TEACHING_CORPUS.map((chunk) => ({
      id: chunk.id,
      x: chunk.vector[0],
      y: chunk.vector[1],
      isMatch: rankedIds.has(chunk.id),
      isSelected: selected.has(chunk.id),
      isQuery: false,
    })).concat({
      id: 'query',
      x: queryVec[0],
      y: queryVec[1],
      isMatch: true,
      isSelected: true,
      isQuery: true,
    });
  });

  readonly contextUsedPercent = computed(() => {
    const max = this.maxChars();
    if (max <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.assembledContext().length / max) * 100));
  });

  constructor() {
    this.syncSelectionFromRankings();
  }

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  toggleChunk(id: string): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    this.syncSelectionFromRankings();
  }

  onTopKChange(value: number): void {
    this.topK.set(value);
    this.syncSelectionFromRankings();
  }

  markLabComplete(): void {
    this.progress.markComplete('rag-playground-lab');
  }

  plotX(value: number): number {
    return 20 + value * 160;
  }

  plotY(value: number): number {
    return 180 - value * 160;
  }

  private syncSelectionFromRankings(): void {
    const ids = this.rankings().map((row) => row.chunk.id);
    this.selectedIds.set(new Set(ids));
  }
}
