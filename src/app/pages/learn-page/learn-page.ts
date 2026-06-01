import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface LearnTopic {
  title: string;
  description: string;
  route: string | null;
  badge?: string;
}

@Component({
  selector: 'app-learn-page',
  imports: [RouterLink],
  templateUrl: './learn-page.html',
  styleUrl: './learn-page.css',
})
export class LearnPage {
  readonly topics: LearnTopic[] = [
    {
      title: 'Neural networks',
      description:
        'A neural network learns from examples — like flash cards. See how a tiny one guesses answers and gets better with practice.',
      route: '/learn/neural-network',
      badge: 'Start here',
    },
    {
      title: 'Evaluating AI answers',
      description:
        'How rubrics, scoring, and side-by-side comparison help you judge which model response is best.',
      route: null,
      badge: 'Coming soon',
    },
  ];
}
