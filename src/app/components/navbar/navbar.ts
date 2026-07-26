import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import {
  LEARN_TRACKS,
  getHubLessonsForTrack,
  getNextLesson,
  type LearnTrackId,
} from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { EvaluationService } from '../../services/evaluation.service';
import { SettingsService } from '../../services/settings.service';
import { isLearnAppPath } from '../../utils/is-learn-app-path';

export interface AppRailTrackRow {
  id: LearnTrackId;
  title: string;
  done: number;
  total: number;
  anchor: string;
}

const RAIL_COLLAPSED_KEY = 'aieval.railCollapsed';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
  host: {
    '[class.app-navbar--collapsed]': 'railCollapsed()',
  },
})
export class Navbar {
  private readonly evaluationService = inject(EvaluationService);
  private readonly settingsService = inject(SettingsService);
  private readonly progress = inject(LearnProgressService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly automating = computed(() => this.evaluationService.isAutomating());
  protected readonly onLearn = computed(() => isLearnAppPath(this.url() ?? ''));
  protected readonly menuOpen = signal(false);
  protected readonly railCollapsed = signal(this.readCollapsed());

  protected readonly trackIndex = computed((): AppRailTrackRow[] => {
    const completed = this.progress.completedIds();
    return LEARN_TRACKS.map((track) => {
      const lessons = getHubLessonsForTrack(track.id).filter((lesson) => lesson.status === 'live');
      const done = lessons.filter((lesson) => completed.has(lesson.id)).length;
      return {
        id: track.id,
        title: track.title,
        done,
        total: lessons.length,
        anchor: `track-${track.id}`,
      };
    });
  });

  protected readonly activeTrackId = computed((): LearnTrackId => {
    const next = getNextLesson(this.progress.completedIds());
    return next?.trackId ?? 'foundation';
  });

  constructor() {
    document.documentElement.classList.toggle('app-rail-collapsed', this.railCollapsed());

    effect(() => {
      const collapsed = this.railCollapsed();
      document.documentElement.classList.toggle('app-rail-collapsed', collapsed);
      try {
        localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? '1' : '0');
      } catch {
        /* ignore quota / private mode */
      }
    });
  }

  protected openSettings(): void {
    this.menuOpen.set(false);
    this.settingsService.open();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected toggleRailCollapsed(): void {
    this.railCollapsed.update((collapsed) => !collapsed);
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(RAIL_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }
}
