import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { EvaluationService } from '../../services/evaluation.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly evaluationService = inject(EvaluationService);
  private readonly settingsService = inject(SettingsService);

  protected readonly automating = computed(() => this.evaluationService.isAutomating());

  protected openSettings(): void {
    this.settingsService.open();
  }
}
