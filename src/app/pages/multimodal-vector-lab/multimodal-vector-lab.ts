import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnLockedCallout } from '../../components/learn-locked-callout/learn-locked-callout';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  CHALLENGE_QUERY_ID,
  QUERY_PRESETS,
  getQueryPreset,
  isChallengeSolved,
  rankCatalog,
  type CatalogFilters,
} from '../../utils/multimodal-vector/multimodal-vector';

@Component({
  selector: 'app-multimodal-vector-lab',
  imports: [DecimalPipe, FormsModule, RouterLink, LearnTermHint, LearnLabNav, PageShell, LearnLockedCallout],
  templateUrl: './multimodal-vector-lab.html',
  styleUrl: './multimodal-vector-lab.css',
})
export class MultimodalVectorLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('multimodal-vector-databases-lab');
  readonly parentMeta = getLesson(this.labMeta?.parentLessonId ?? '');
  readonly queryPresets = QUERY_PRESETS;
  readonly challengeQueryId = CHALLENGE_QUERY_ID;

  readonly queryId = signal(CHALLENGE_QUERY_ID);
  readonly tenantFilter = signal<'shop-a' | 'all'>('all');
  readonly waterproofOnly = signal(false);
  readonly openTermId = signal<string | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('multimodal-vector-databases-lab');
  });

  readonly activeQuery = computed(() => getQueryPreset(this.queryId()) ?? QUERY_PRESETS[0]!);

  readonly filters = computed((): CatalogFilters => ({
    tenant: this.tenantFilter(),
    waterproofOnly: this.waterproofOnly(),
  }));

  readonly rankings = computed(() => rankCatalog(this.activeQuery(), this.filters()));

  readonly solved = computed(() =>
    isChallengeSolved(this.rankings(), this.queryId(), this.filters()),
  );

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  selectQuery(id: string): void {
    this.queryId.set(id);
  }

  setTenantFilter(value: 'shop-a' | 'all'): void {
    this.tenantFilter.set(value);
  }

  setWaterproofOnly(value: boolean): void {
    this.waterproofOnly.set(value);
  }

  markLabComplete(): void {
    if (!this.solved()) {
      return;
    }
    this.progress.markComplete('multimodal-vector-databases-lab');
  }
}
