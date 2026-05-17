import { Component, inject } from '@angular/core';

import { FeedbackService } from '../../services/feedback.service';

@Component({
  selector: 'app-status-alert',
  imports: [],
  templateUrl: './status-alert.html',
})
export class StatusAlert {
  protected readonly feedbackService = inject(FeedbackService);
}
