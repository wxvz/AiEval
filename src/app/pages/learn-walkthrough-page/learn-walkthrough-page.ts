import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';

import { LearnLabNav } from '../../components/learn-lab-nav/learn-lab-nav';
import { PageShell } from '../../components/page-shell/page-shell';
import { getLesson, getLessonsForTrack, getNavigableAdjacent, getTrack } from '../../learn/curriculum';
import { LearnHandoffService } from '../../learn/learn-handoff.service';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { loadWalkthroughContent } from '../../learn/walkthrough-content';

@Component({
  selector: 'app-learn-walkthrough-page',
  imports: [RouterLink, LearnLabNav, PageShell],
  templateUrl: './learn-walkthrough-page.html',
  styleUrl: './learn-walkthrough-page.css',
})
export class LearnWalkthroughPage {
  private readonly progress = inject(LearnProgressService);
  private readonly handoff = inject(LearnHandoffService);
  private readonly route = inject(ActivatedRoute);

  readonly lessonId = toSignal(
    this.route.data.pipe(
      map((data) =>
        typeof data['lessonId'] === 'string' ? data['lessonId'] : 'first-evaluation-lab',
      ),
    ),
    { initialValue: 'first-evaluation-lab' },
  );

  readonly meta = computed(() => getLesson(this.lessonId()));
  readonly prereqMeta = computed(() => getLesson(this.meta()?.prerequisites[0] ?? ''));
  readonly nextLessonMeta = computed(() => getNavigableAdjacent(this.lessonId()).next);
  readonly content = computed(() => loadWalkthroughContent(this.lessonId()));
  readonly hasSteps = computed(() => this.content().steps.length > 0);
  readonly trackLabCount = getLessonsForTrack('llm-systems').filter(
    (lesson) => lesson.status === 'live',
  ).length;
  readonly trackLabel = computed(() => {
    const trackId = this.meta()?.trackId;
    const trackTitle = trackId ? getTrack(trackId)?.title : null;
    return trackTitle ?? 'Lab';
  });
  readonly completed = computed(() => {
    this.progress.completedIds();
    return this.progress.isComplete(this.lessonId());
  });
  readonly canMarkComplete = computed(() => {
    const meta = this.meta();
    this.handoff.highlightedEvaluationId();
    return meta ? this.progress.canMarkComplete(meta) : false;
  });
  readonly leadText = computed(() =>
    this.lessonId() === 'support-bot-decision-lab'
      ? 'Run a full Acme support comparison in AiEval, then make a ship, ship-other or neither call backed by rubric rows.'
      : 'Warm up AiEval with a seeded Acme support prompt, run automation and open Compare once.',
  );

  markComplete(): void {
    if (!this.canMarkComplete()) {
      return;
    }
    const id = this.lessonId();
    this.progress.markComplete(id);
    this.handoff.clearLesson(id);
  }

  actionPath(actionRoute: string): string {
    return actionRoute.split('?')[0] || '/';
  }

  actionQueryParams(actionRoute: string): Record<string, string> {
    const query = actionRoute.split('?')[1];
    if (!query) {
      return {};
    }
    const params: Record<string, string> = {};
    for (const part of query.split('&')) {
      if (!part) {
        continue;
      }
      const eq = part.indexOf('=');
      const rawKey = eq === -1 ? part : part.slice(0, eq);
      const rawValue = eq === -1 ? '' : part.slice(eq + 1);
      const key = decodeURIComponent(rawKey);
      if (key) {
        params[key] = decodeURIComponent(rawValue);
      }
    }
    return params;
  }
}
