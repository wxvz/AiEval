import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { EvaluationService } from '../../services/evaluation.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly evaluationService = inject(EvaluationService);
  private readonly themeService = inject(ThemeService);

  protected readonly automating = computed(() => this.evaluationService.isAutomating());
  protected readonly theme = this.themeService.theme;

  protected toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
