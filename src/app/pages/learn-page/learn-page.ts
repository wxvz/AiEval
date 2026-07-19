import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnRoadmap } from '../../components/learn-roadmap/learn-roadmap';
import { LearnTrackList } from '../../components/learn-track-list/learn-track-list';
import { PageShell } from '../../components/page-shell/page-shell';
import { getNextLesson } from '../../learn/curriculum';
import { HUB_COPY } from '../../learn/hub-content';
import { LearnProgressService } from '../../learn/learn-progress.service';

@Component({
  selector: 'app-learn-page',
  imports: [RouterLink, LearnRoadmap, LearnTrackList, PageShell],
  templateUrl: './learn-page.html',
  styleUrl: './learn-page.css',
})
export class LearnPage {
  private readonly progress = inject(LearnProgressService);

  readonly hubCopy = HUB_COPY;
  readonly nextLesson = computed(() => getNextLesson(this.progress.completedIds()));
}
