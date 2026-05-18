import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { EvaluationService } from '../../services/evaluation.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly evaluationService = inject(EvaluationService);

  protected readonly automating = computed(() => this.evaluationService.isAutomating());
}
