import { describe, expect, it, vi } from 'vitest';

import {
  CONFIRM_LEAVE_DURING_AUTOMATION_MODAL_ID,
  LeaveDuringAutomationPrompt,
} from './leave-during-automation-prompt';

describe('LeaveDuringAutomationPrompt', () => {
  const show = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = '';
    show.mockClear();
    vi.stubGlobal('bootstrap', {
      Modal: {
        getOrCreateInstance: () => ({ show, hide: vi.fn() }),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the same promise when prompt is called twice before resolution', async () => {
    const modalElement = document.createElement('div');
    modalElement.id = CONFIRM_LEAVE_DURING_AUTOMATION_MODAL_ID;
    document.body.appendChild(modalElement);

    const prompt = new LeaveDuringAutomationPrompt();
    const first = prompt.prompt();
    const second = prompt.prompt();

    expect(first).toBe(second);
    expect(show).toHaveBeenCalledTimes(1);

    prompt.cancelLeave();

    await expect(first).resolves.toBe(false);
    await expect(second).resolves.toBe(false);
  });

  it('resolves false immediately when the modal element is missing', async () => {
    const prompt = new LeaveDuringAutomationPrompt();

    await expect(prompt.prompt()).resolves.toBe(false);
  });
});
