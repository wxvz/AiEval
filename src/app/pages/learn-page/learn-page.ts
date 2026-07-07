import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { LearnRoadmap } from '../../components/learn-roadmap/learn-roadmap';
import { LearnTrackList } from '../../components/learn-track-list/learn-track-list';
import { HUB_COPY } from '../../learn/learn-content';

@Component({
  selector: 'app-learn-page',
  imports: [RouterLink, LearnRoadmap, LearnTrackList],
  templateUrl: './learn-page.html',
  styleUrl: './learn-page.css',
})
export class LearnPage {
  readonly hubCopy = HUB_COPY;
}
