import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-shell',
  templateUrl: './page-shell.html',
  styleUrl: './page-shell.css',
})
export class PageShell {
  /**
   * When true alone, main spans the left column and the left aside is hidden
   * (pages with no shellLeft content).
   * Combined with spanRight, main spans all 3 columns and the left aside stays
   * visible (e.g. dashboard day rail + centered evaluations).
   */
  readonly wideMain = input(false);
  /**
   * When true alone, main spans the right column and the right aside is hidden.
   * Combined with wideMain, main spans all 3 columns (see wideMain).
   */
  readonly spanRight = input(false);
}
