import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { LearnTermHint } from '../../components/learn-term-hint/learn-term-hint';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import {
  FEATURE_OPTIONS,
  LABEL_OPTIONS,
  TICKET_ROWS,
  type TicketFeature,
  type TicketLabel,
  type TreeDraft,
  accuracy,
  evaluateRows,
  isSolved,
  partitionRows,
} from '../../utils/decision-trees/decision-trees';

@Component({
  selector: 'app-decision-trees-lab',
  imports: [DecimalPipe, RouterLink, LearnTermHint, LearnLabNav, PageShell],
  templateUrl: './decision-trees-lab.html',
  styleUrl: './decision-trees-lab.css',
})
export class DecisionTreesLabPage {
  private readonly progress = inject(LearnProgressService);

  readonly labMeta = getLesson('decision-trees-lab');
  readonly prereqMeta = getLesson(this.labMeta?.prerequisites[0] ?? '');
  readonly rows = TICKET_ROWS;
  readonly featureOptions = FEATURE_OPTIONS;
  readonly labelOptions = LABEL_OPTIONS;

  readonly openTermId = signal<string | null>(null);
  readonly feature = signal<TicketFeature | null>(null);
  readonly yesLabel = signal<TicketLabel | null>(null);
  readonly noLabel = signal<TicketLabel | null>(null);

  readonly labCompleted = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete('decision-trees-lab');
  });

  readonly tree = computed<TreeDraft>(() => ({
    feature: this.feature(),
    yesLabel: this.yesLabel(),
    noLabel: this.noLabel(),
  }));

  readonly branches = computed(() => {
    const selected = this.feature();
    if (!selected) {
      return null;
    }
    return partitionRows(this.rows, selected);
  });

  readonly evaluations = computed(() => evaluateRows(this.rows, this.tree()));

  readonly treeAccuracy = computed(() => accuracy(this.rows, this.tree()));

  readonly solved = computed(() => isSolved(this.tree()));

  setOpenTermId(id: string | null): void {
    this.openTermId.set(id);
  }

  selectFeature(feature: TicketFeature): void {
    this.feature.set(feature);
  }

  selectYesLabel(label: TicketLabel): void {
    this.yesLabel.set(label);
  }

  selectNoLabel(label: TicketLabel): void {
    this.noLabel.set(label);
  }

  reset(): void {
    this.feature.set(null);
    this.yesLabel.set(null);
    this.noLabel.set(null);
  }

  markLabComplete(): void {
    if (!this.solved()) {
      return;
    }
    this.progress.markComplete('decision-trees-lab');
  }
}
