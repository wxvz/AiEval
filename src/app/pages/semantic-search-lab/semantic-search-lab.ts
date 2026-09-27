import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnLabLink } from '../../components/learn-lab-link/learn-lab-link';
import { LearnLockedCallout } from '../../components/learn-locked-callout/learn-locked-callout';
import { PageShell } from '../../components/page-shell/page-shell';
import { RetrievalTermHint } from '../../components/retrieval-term-hint/retrieval-term-hint';
import { getLesson, getLessonsForTrack, getTrack } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { TEACHING_CORPUS } from '../../utils/retrieval/corpus';
import { rankByQuery } from '../../utils/retrieval/similarity';
import { queryToVector } from '../../utils/retrieval/vocabulary';

const PRESET_QUERIES = [
  'evaluation rubric',
  'semantic search retrieval',
  'neural network training',
  'RAG context window',
];

@Component({
  selector: 'app-semantic-search-lab',
  imports: [FormsModule, DecimalPipe, RouterLink, RetrievalTermHint, LearnLabNav, LearnLockedCallout, PageShell, LearnLabLink],
  templateUrl: './semantic-search-lab.html',
  styleUrl: './semantic-search-lab.css',
})
export class SemanticSearchLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('semantic-search-lab');
  readonly prereqMeta = getLesson(this.labMeta?.prerequisites[0] ?? '');
  readonly trackLabel = getTrack('llm-systems')?.title ?? 'LLM systems';
  readonly trackLabCount = getLessonsForTrack('llm-systems').filter((lesson) => lesson.status === 'live').length;
  readonly presetQueries = PRESET_QUERIES;

  readonly query = signal('evaluation rubric');
  readonly topK = signal(3);
  readonly openTermId = signal<string | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('semantic-search-lab');
  });

  readonly rankings = computed(() => rankByQuery(this.query(), this.topK()));

  readonly queryVector = computed(() => queryToVector(this.query()));

  readonly plotPoints = computed(() => {
    const queryVec = this.queryVector();
    const rankedIds = new Set(this.rankings().map((row) => row.chunk.id));
    return TEACHING_CORPUS.map((chunk) => ({
      id: chunk.id,
      x: chunk.vector[0],
      y: chunk.vector[1],
      isMatch: rankedIds.has(chunk.id),
      isQuery: false,
    })).concat({
      id: 'query',
      x: queryVec[0],
      y: queryVec[1],
      isMatch: true,
      isQuery: true,
    });
  });

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  usePreset(preset: string): void {
    this.query.set(preset);
  }

  markLabComplete(): void {
    this.progress.markComplete('semantic-search-lab');
  }

  plotX(value: number): number {
    return 20 + value * 160;
  }

  plotY(value: number): number {
    return 180 - value * 160;
  }
}
