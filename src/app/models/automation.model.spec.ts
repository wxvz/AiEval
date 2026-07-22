import { automationProgressLabel } from './automation.model';

describe('automationProgressLabel', () => {
  it('shows provider only for provider_resolved', () => {
    expect(
      automationProgressLabel({ type: 'provider_resolved', provider: 'groq' }),
    ).toBe('Using Provider Groq');
  });

  it('formats generating with model and optional slot progress', () => {
    expect(
      automationProgressLabel({
        type: 'generating',
        modelLabel: 'llama-3.1-8b-instant',
        index: 1,
        total: 3,
      }),
    ).toBe('llama-3.1-8b-instant is generating answer (1/3)');

    expect(
      automationProgressLabel({
        type: 'generating',
        modelLabel: 'llama-3.1-8b-instant',
        index: 1,
        total: 1,
      }),
    ).toBe('llama-3.1-8b-instant is generating answer');
  });

  it('formats scoring_batch with judge model', () => {
    expect(
      automationProgressLabel({
        type: 'scoring_batch',
        modelLabel: 'llama-3.3-70b-versatile',
      }),
    ).toBe('llama-3.3-70b-versatile — Scoring answers');
  });

  it('formats improved_generating with model', () => {
    expect(
      automationProgressLabel({
        type: 'improved_generating',
        modelLabel: 'llama-3.3-70b-versatile',
      }),
    ).toBe('llama-3.3-70b-versatile — Drafting improved answer');
  });
});
