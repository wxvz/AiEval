import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { LearnChatFab } from './components/learn-chat-fab/learn-chat-fab';
import { Navbar } from './components/navbar/navbar';
import { SettingsAside } from './components/settings-aside/settings-aside';
import { StatusAlert } from './components/status-alert/status-alert';
import { isLearnAppPath } from './utils/is-learn-app-path';

export { isLearnAppPath } from './utils/is-learn-app-path';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, SettingsAside, StatusAlert, LearnChatFab],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly isLearnRoute = computed(() => isLearnAppPath(this.url() ?? ''));
}
