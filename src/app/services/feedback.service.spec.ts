import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeedbackService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows success feedback and auto-clears after 5 seconds', () => {
    service.success('Saved.');

    expect(service.feedback()).toEqual({ type: 'success', message: 'Saved.' });

    vi.advanceTimersByTime(5000);

    expect(service.feedback()).toBeNull();
  });

  it('resets the dismiss timer when a new message is shown', () => {
    service.success('First.');
    vi.advanceTimersByTime(4000);
    service.error('Second.');

    vi.advanceTimersByTime(4000);
    expect(service.feedback()?.message).toBe('Second.');

    vi.advanceTimersByTime(1000);
    expect(service.feedback()).toBeNull();
  });

  it('clears feedback immediately when clear is called', () => {
    service.success('Saved.');
    service.clear();

    expect(service.feedback()).toBeNull();
  });
});
