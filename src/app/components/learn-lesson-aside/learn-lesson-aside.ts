import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { LessonAside, LessonContent } from '../../learn/learn-content';
import type { LearnLessonMeta } from '../../learn/curriculum';
import type { LearnGlossaryTerm } from '../../learn/learn-glossary';
import { resolveLearnSafeLink } from '../../learn/learn-lab-lock';
import { pathFromLearnRoute, queryParamsFromLearnRoute } from '../../learn/learn-route';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { SettingsService } from '../../services/settings.service';
import { LearnLessonText } from '../learn-lesson-text/learn-lesson-text';

@Component({
  selector: 'app-learn-lesson-aside',
  imports: [RouterLink, LearnLessonText],
  templateUrl: './learn-lesson-aside.html',
  styleUrl: './learn-lesson-aside.css',
})
export class LearnLessonAside {
  private readonly progress = inject(LearnProgressService);
  private readonly settings = inject(SettingsService);

  readonly content = input<LessonContent | null>(null);
  readonly sectionsSolved = input<boolean[]>([]);
  readonly recapSolved = input<boolean[]>([]);
  readonly recapCount = input(0);
  readonly optionalLab = input<LearnLessonMeta | null>(null);
  readonly optionalLabComplete = input(false);
  /** Route of the read lesson hosting this aside; used to avoid self-nav unlock CTAs. */
  readonly currentLessonRoute = input<string | null>(null);
  readonly adjacent = input<{ previous: LearnLessonMeta | null; next: LearnLessonMeta | null }>({
    previous: null,
    next: null,
  });
  readonly locked = input(false);
  readonly activeAside = input<LessonAside | null>(null);
  readonly savedKeyTerms = input<LearnGlossaryTerm[]>([]);
  readonly primaryHintIds = input<ReadonlyMap<LearnGlossaryTerm, string>>(new Map());
  readonly completed = input(false);
  readonly markCompleteEnabled = input(false);
  readonly termSelect = output<LearnGlossaryTerm>();
  readonly markComplete = output<void>();

  readonly sectionsDone = computed(() => this.sectionsSolved().filter(Boolean).length);
  readonly sectionsTotal = computed(() => this.content()?.sections.length ?? 0);
  readonly sectionsPercent = computed(() => {
    const total = this.sectionsTotal();
    if (total === 0) {
      return 0;
    }
    return Math.round((this.sectionsDone() / total) * 100);
  });

  readonly checksDone = computed(() => {
    const sections = this.sectionsSolved().filter(Boolean).length;
    const recap = this.recapSolved().filter(Boolean).length;
    return sections + recap;
  });

  readonly checksTotal = computed(() => {
    const content = this.content();
    if (!content) {
      return 0;
    }
    return content.sections.length + this.recapCount();
  });

  readonly asideActionLabel = computed(() => {
    const aside = this.activeAside();
    if (!aside?.route) {
      return null;
    }
    return aside.actionLabel?.trim() || 'Open in AiEval';
  });

  private readonly asideSafeLink = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    const route = this.activeAside()?.route;
    if (!route) {
      return null;
    }
    const path = pathFromLearnRoute(route);
    // Only lock-redirect curriculum Learn paths; evaluation CTAs stay as authored.
    if (!path.startsWith('/learn')) {
      return { route: path, locked: false, title: null as string | null };
    }
    return resolveLearnSafeLink(
      path,
      this.progress.completedIds(),
      this.settings.learnUnlockAll(),
    );
  });

  /** Path without query/hash so `[routerLink]` does not encode `?`. */
  readonly asideRoutePath = computed(() => this.asideSafeLink()?.route ?? null);

  readonly asideRouteQueryParams = computed(() => {
    const route = this.activeAside()?.route;
    if (!route) {
      return {};
    }
    // Keep authored query params only when navigating to the original unlocked target.
    if (this.asideSafeLink()?.locked) {
      return {};
    }
    return queryParamsFromLearnRoute(route);
  });

  readonly asideRouteTitle = computed(() => this.asideSafeLink()?.title ?? null);

  readonly optionalLabSafeLink = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    const lab = this.optionalLab();
    if (!lab) {
      return null;
    }
    return resolveLearnSafeLink(
      lab.route,
      this.progress.completedIds(),
      this.settings.learnUnlockAll(),
    );
  });

  readonly optionalLabNeedsSelfComplete = computed(() => {
    const safe = this.optionalLabSafeLink();
    const current = this.currentLessonRoute();
    return Boolean(safe?.locked && current && safe.route === current);
  });

  readonly previousAdjacentSafe = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    const previous = this.adjacent().previous;
    if (!previous) {
      return null;
    }
    const safe = resolveLearnSafeLink(
      previous.route,
      this.progress.completedIds(),
      this.settings.learnUnlockAll(),
    );
    return { label: previous.title, route: safe.route, hint: safe.title };
  });

  readonly nextAdjacentSafe = computed(() => {
    this.progress.completedIds();
    this.settings.learnUnlockAll();
    const next = this.adjacent().next;
    if (!next) {
      return null;
    }
    const safe = resolveLearnSafeLink(
      next.route,
      this.progress.completedIds(),
      this.settings.learnUnlockAll(),
    );
    return { label: next.title, route: safe.route, hint: safe.title };
  });

  onTermSelect(term: LearnGlossaryTerm): void {
    this.termSelect.emit(term);
  }
}
